import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings, customers, leads } from "@/db/schema";
import { extractLeadData } from "@/lib/ai";
import { looksLikePersonName } from "@/lib/ai/parse-inquiry";

export type CollectedLeadData = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  title?: string;
  description?: string;
  source?: string;
};

export type LeadAgentState = {
  lead: CollectedLeadData;
  pendingField?: "naam" | "email of telefoon" | "omschrijving aanvraag";
};

export type AgentReply = {
  content: string;
  questionType?: "text" | "yes_no" | "choice";
  options?: string[];
  collectedData: CollectedLeadData;
  stateJson: string;
  action?: "create_customer_lead" | "none";
  createdCustomerId?: number;
  createdLeadId?: number;
};

function parseState(raw: string | null): LeadAgentState {
  if (!raw) return { lead: {} };
  try {
    const parsed = JSON.parse(raw) as LeadAgentState | CollectedLeadData;
    if ("lead" in parsed && parsed.lead) {
      return { lead: parsed.lead, pendingField: parsed.pendingField };
    }
    return { lead: parsed as CollectedLeadData };
  } catch {
    return { lead: {} };
  }
}

function serializeState(state: LeadAgentState): string {
  return JSON.stringify(state);
}

function missingFields(data: CollectedLeadData): string[] {
  const missing: string[] = [];
  if (!data.name) missing.push("naam");
  if (!data.email && !data.phone) missing.push("email of telefoon");
  if (!data.title && !data.description) missing.push("omschrijving aanvraag");
  return missing;
}

function isRichInquiryPaste(text: string): boolean {
  return text.length > 120 || /@/.test(text) || /E\.\s*\S+@/i.test(text);
}

function pickField<T>(existing: T | undefined, fresh: T | undefined, rich: boolean): T | undefined {
  return rich ? (fresh ?? existing) : (existing ?? fresh);
}

function applyDirectAnswer(
  data: CollectedLeadData,
  field: LeadAgentState["pendingField"],
  answer: string
): CollectedLeadData {
  const trimmed = answer.trim();
  if (!trimmed || !field) return data;

  if (field === "naam") {
    return { ...data, name: trimmed };
  }

  if (field === "email of telefoon") {
    if (trimmed.includes("@")) return { ...data, email: trimmed.toLowerCase() };
    return { ...data, phone: trimmed };
  }

  if (field === "omschrijving aanvraag") {
    return { ...data, description: trimmed, title: data.title ?? trimmed.slice(0, 120) };
  }

  return data;
}

function inferDirectAnswer(data: CollectedLeadData, text: string): CollectedLeadData {
  const trimmed = text.trim();
  if (!trimmed || isRichInquiryPaste(trimmed)) return data;

  const missing = missingFields(data);
  if (missing.length !== 1) return data;

  const field = missing[0];
  if (field === "naam" && looksLikePersonName(trimmed)) {
    return { ...data, name: trimmed };
  }
  if (field === "email of telefoon") {
    if (trimmed.includes("@")) return { ...data, email: trimmed.toLowerCase() };
    if (/[\d+][\d\s().-]{6,}/.test(trimmed)) return { ...data, phone: trimmed };
  }
  if (field === "omschrijving aanvraag" && trimmed.length > 8) {
    return { ...data, description: trimmed, title: trimmed.slice(0, 120) };
  }

  return data;
}

async function mergeFromText(
  existing: CollectedLeadData,
  text: string
): Promise<CollectedLeadData> {
  const extracted = await extractLeadData(text);
  const rich = isRichInquiryPaste(text);
  return {
    name: pickField(existing.name, extracted.name ?? undefined, rich),
    company: pickField(existing.company, extracted.company ?? undefined, rich),
    email: pickField(existing.email, extracted.email ?? undefined, rich),
    phone: pickField(existing.phone, extracted.phone ?? undefined, rich),
    title: pickField(existing.title, extracted.title ?? undefined, rich),
    description:
      pickField(existing.description, extracted.description ?? undefined, rich) ??
      (rich ? text : existing.description),
    source: pickField(existing.source, extracted.source ?? undefined, rich) ?? "manual",
  };
}

const FIELD_QUESTIONS: Record<string, string> = {
  naam: "Wat is de naam van de klant?",
  "email of telefoon": "Wat is het e-mailadres of telefoonnummer van de klant?",
  "omschrijving aanvraag": "Kun je kort omschrijven wat de klant wil (fles, thema, aantal)?",
};

export async function getLeadAgentGreeting(): Promise<AgentReply> {
  return {
    content:
      "Hoi! Ik ben de Aanvraag Agent. Plak een volledige mail of aanvraag — ik haal daar automatisch naam, contact en wensen uit. Daarna kan ik klant + aanvraag voor je aanmaken.",
    questionType: "text",
    collectedData: {},
    stateJson: serializeState({ lead: {} }),
    action: "none",
  };
}

export async function processLeadAgentTurn(params: {
  userMessage: string;
  collectedRaw: string | null;
  conversationContext?: string;
  isYesNoAnswer?: "yes" | "no";
  pendingConfirm?: boolean;
}): Promise<AgentReply> {
  const state = parseState(params.collectedRaw);
  let data = { ...state.lead };

  if (params.isYesNoAnswer === "yes" && params.pendingConfirm) {
    if (!data.name) {
      return {
        content: FIELD_QUESTIONS.naam,
        questionType: "text",
        collectedData: data,
        stateJson: serializeState({ lead: data, pendingField: "naam" }),
        action: "none",
      };
    }

    let customerId: number | null = null;
    if (data.email) {
      const [existing] = await db
        .select()
        .from(customers)
        .where(eq(customers.email, data.email))
        .limit(1);
      if (existing) customerId = existing.id;
    }

    if (!customerId) {
      const [created] = await db
        .insert(customers)
        .values({
          name: data.name,
          company: data.company ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
        })
        .returning();
      customerId = created.id;
    }

    const [lead] = await db
      .insert(leads)
      .values({
        customerId,
        source: (data.source as "manual") ?? "manual",
        title: data.title ?? "Nieuwe aanvraag via agent-chat",
        description: data.description ?? null,
        status: "new",
        missingFields: JSON.stringify(missingFields(data)),
      })
      .returning();

    return {
      content: `Klaar! Ik heb klant **${data.name}** en aanvraag #${lead.id} aangemaakt. Je kunt ze openen via Klanten en Aanvragen.`,
      questionType: "text",
      collectedData: data,
      stateJson: serializeState({ lead: data }),
      action: "create_customer_lead",
      createdCustomerId: customerId,
      createdLeadId: lead.id,
    };
  }

  if (params.isYesNoAnswer === "no" && params.pendingConfirm) {
    return {
      content: "Geen probleem. Wat wil je nog aanpassen of toevoegen?",
      questionType: "text",
      collectedData: data,
      stateJson: serializeState({ lead: data }),
      action: "none",
    };
  }

  const richPaste = isRichInquiryPaste(params.userMessage);
  const extractionText =
    richPaste
      ? params.userMessage
      : (params.conversationContext?.trim() || params.userMessage);

  if (state.pendingField && !richPaste) {
    data = applyDirectAnswer(data, state.pendingField, params.userMessage);
  } else {
    data = inferDirectAnswer(data, params.userMessage);
  }

  data = await mergeFromText(data, extractionText);

  const missing = missingFields(data);

  if (missing.length === 0) {
    return {
      content: `Ik heb dit uit de tekst gehaald:\n\n- **Naam:** ${data.name}\n- **Bedrijf:** ${data.company ?? "—"}\n- **E-mail:** ${data.email ?? "—"}\n- **Telefoon:** ${data.phone ?? "—"}\n- **Aanvraag:** ${data.title ?? data.description?.slice(0, 100)}\n\nZal ik klant en aanvraag nu in het systeem aanmaken?`,
      questionType: "yes_no",
      collectedData: data,
      stateJson: serializeState({ lead: data }),
      action: "none",
    };
  }

  const field = missing[0] as LeadAgentState["pendingField"];
  return {
    content: FIELD_QUESTIONS[field ?? missing[0]] ?? `Kun je ${missing[0]} nog doorgeven?`,
    questionType: "text",
    collectedData: data,
    stateJson: serializeState({ lead: data, pendingField: field }),
    action: "none",
  };
}

export function isPendingConfirmation(
  lastAssistantMessage: { questionType?: string | null; content: string } | null
): boolean {
  if (!lastAssistantMessage) return false;
  return (
    lastAssistantMessage.questionType === "yes_no" &&
    lastAssistantMessage.content.toLowerCase().includes("aanmaken")
  );
}
