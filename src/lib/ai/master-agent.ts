import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  customers,
  leads,
} from "@/db/schema";
import {
  classifyIncomingMessage,
  extractLeadData,
  generateCustomerReply,
  generateWorkInstructionFromText,
} from "@/lib/ai";
import { consultPricingAgent } from "@/lib/ai/pricing-agent";
import type { AgentReply, CollectedLeadData } from "@/lib/ai/agent-chat";

export type MasterSessionState = {
  lead: CollectedLeadData;
  intent?: string;
  pricingNote?: string;
  contactDraft?: string;
  workbonNote?: string;
  phase?: "gathering" | "confirm_create" | "done";
};

export type MasterAgentReply = AgentReply & {
  internalDeliberation: Array<{ agent: string; note: string }>;
  stateJson: string;
};

function parseState(raw: string | null): MasterSessionState {
  if (!raw) return { lead: {}, phase: "gathering" };
  try {
    const parsed = JSON.parse(raw) as MasterSessionState;
    return { ...parsed, lead: parsed.lead ?? {} };
  } catch {
    return { lead: {}, phase: "gathering" };
  }
}

function missingLeadFields(data: CollectedLeadData): string[] {
  const missing: string[] = [];
  if (!data.name) missing.push("naam klant");
  if (!data.email && !data.phone) missing.push("e-mail of telefoon");
  if (!data.title && !data.description) missing.push("omschrijving aanvraag");
  return missing;
}

function isRichInquiryPaste(text: string): boolean {
  return text.length > 120 || /@/.test(text) || /E\.\s*\S+@/i.test(text);
}

function pickField<T>(existing: T | undefined, fresh: T | undefined, rich: boolean): T | undefined {
  return rich ? (fresh ?? existing) : (existing ?? fresh);
}

async function consultSubAgents(
  userMessage: string,
  lead: CollectedLeadData
): Promise<{
  intent: string;
  deliberation: Array<{ agent: string; note: string }>;
  lead: CollectedLeadData;
  pricingNote: string;
  contactDraft: string;
  workbonNote: string;
}> {
  const deliberation: Array<{ agent: string; note: string }> = [];

  const classification = await classifyIncomingMessage(userMessage);
  const extracted = await extractLeadData(userMessage);
  const rich = isRichInquiryPaste(userMessage);
  const mergedLead: CollectedLeadData = {
    name: pickField(lead.name, extracted.name ?? undefined, rich),
    company: pickField(lead.company, extracted.company ?? undefined, rich),
    email: pickField(lead.email, extracted.email ?? undefined, rich),
    phone: pickField(lead.phone, extracted.phone ?? undefined, rich),
    title: pickField(lead.title, extracted.title ?? undefined, rich),
    description:
      pickField(lead.description, extracted.description ?? undefined, rich) ?? userMessage,
    source: pickField(lead.source, extracted.source ?? undefined, rich) ?? "manual",
  };

  deliberation.push({
    agent: "Aanvraag Agent",
    note: [
      `Intentie: ${classification.type}.`,
      mergedLead.name ? `Naam: ${mergedLead.name}` : null,
      mergedLead.company ? `Bedrijf: ${mergedLead.company}` : null,
      mergedLead.email ? `E-mail: ${mergedLead.email}` : null,
      mergedLead.phone ? `Tel: ${mergedLead.phone}` : null,
      mergedLead.title ? `Aanvraag: ${mergedLead.title}` : null,
      (extracted as { wantsQuote?: boolean }).wantsQuote ? "Wil prijsopgave" : null,
      (extracted as { wantsProofDesign?: boolean }).wantsProofDesign
        ? "Wil proefdesign"
        : null,
      (extracted as { theme?: string | null }).theme
        ? `Thema: ${(extracted as { theme?: string }).theme}`
        : null,
    ]
      .filter(Boolean)
      .join(" | "),
  });

  const desc = mergedLead.description ?? userMessage;
  const pricingNote = await consultPricingAgent(desc, { audience: "internal" });
  deliberation.push({ agent: "Prijs Agent", note: pricingNote });

  const contactDraft = await generateCustomerReply({
    messageBody: userMessage,
    classification: classification.type,
  });
  deliberation.push({
    agent: "Klantcontact Agent",
    note: `Conceptantwoord gereed (${contactDraft.slice(0, 120)}...).`,
  });

  const workbon = await generateWorkInstructionFromText(desc);
  deliberation.push({
    agent: "Werkbon Agent",
    note: `Richtlijn-concept: thema "${workbon.theme}", stijl "${workbon.style}".`,
  });

  return {
    intent: classification.type,
    deliberation,
    lead: mergedLead,
    pricingNote,
    contactDraft,
    workbonNote: `Thema: ${workbon.theme}`,
  };
}

export async function getMasterAgentGreeting(): Promise<MasterAgentReply> {
  return {
    content:
      "Hoi! Ik ben de **Meester Agent**. Ik overleg intern met de Aanvraag-, Prijs-, Klantcontact- en Werkbon-agent voordat ik je antwoord. Beschrijf je vraag of plak een klantbericht — ik stel zo nodig vervolgvragen en kan daarna klant + aanvraag voor je aanmaken.",
    questionType: "text",
    collectedData: {},
    action: "none",
    internalDeliberation: [],
    stateJson: JSON.stringify({ lead: {}, phase: "gathering" }),
  };
}

export async function processMasterAgentTurn(params: {
  userMessage: string;
  stateRaw: string | null;
  isYesNoAnswer?: "yes" | "no";
  pendingConfirm?: boolean;
}): Promise<MasterAgentReply> {
  const state = parseState(params.stateRaw);

  if (params.isYesNoAnswer === "yes" && params.pendingConfirm) {
    const data = state.lead;
    if (!data.name) {
      return {
        content: "Ik mis nog een klantnaam. Wat is de naam?",
        questionType: "text",
        collectedData: data,
        action: "none",
        internalDeliberation: [
          { agent: "Meester Agent", note: "Actie uitgesteld: naam ontbreekt." },
        ],
        stateJson: params.stateRaw ?? JSON.stringify({ lead: data, phase: "gathering" }),
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

    const [leadRow] = await db
      .insert(leads)
      .values({
        customerId,
        source: (data.source as "manual") ?? "manual",
        title: data.title ?? "Aanvraag via Meester Agent",
        description: data.description ?? null,
        status: "new",
        missingFields: JSON.stringify(missingLeadFields(data)),
      })
      .returning();

    return {
      content: `Klaar! Na intern overleg heb ik **${data.name}** en aanvraag #${leadRow.id} aangemaakt.\n\n- Prijsindicatie: ${state.pricingNote ?? "—"}\n- Werkbon-concept: ${state.workbonNote ?? "—"}\n\nBekijk ze onder Klanten en Aanvragen.`,
      questionType: "text",
      collectedData: data,
      action: "create_customer_lead",
      createdCustomerId: customerId,
      createdLeadId: leadRow.id,
      internalDeliberation: [
        { agent: "Aanvraag Agent", note: "Klant + aanvraag aangemaakt in database." },
        { agent: "Prijs Agent", note: state.pricingNote ?? "Geen prijsindicatie." },
        { agent: "Werkbon Agent", note: state.workbonNote ?? "Geen werkbon." },
      ],
      stateJson: JSON.stringify({ ...state, phase: "done" }),
    };
  }

  if (params.isYesNoAnswer === "no" && params.pendingConfirm) {
    return {
      content: "Prima. Wat wil je aanpassen of toevoegen?",
      questionType: "text",
      collectedData: state.lead,
      action: "none",
      internalDeliberation: [
        { agent: "Meester Agent", note: "Aanmaken geannuleerd door gebruiker." },
      ],
      stateJson: params.stateRaw ?? JSON.stringify({ lead: state.lead, phase: "gathering" }),
    };
  }

  const consultation = await consultSubAgents(params.userMessage, state.lead);
  const missing = missingLeadFields(consultation.lead);

  const deliberationBlock = consultation.deliberation
    .map((d) => `• **${d.agent}:** ${d.note}`)
    .join("\n");

  if (missing.length === 0) {
    return {
      content: `Ik heb intern overlegd:\n\n${deliberationBlock}\n\n**Samenvatting**\n- Klant: ${consultation.lead.name}\n- Bedrijf: ${consultation.lead.company ?? "—"}\n- Contact: ${consultation.lead.email ?? consultation.lead.phone}\n- Aanvraag: ${consultation.lead.title}\n- Details: ${consultation.lead.description?.slice(0, 200)}...\n\nZal ik klant en aanvraag nu aanmaken?`,
      questionType: "yes_no",
      collectedData: consultation.lead,
      action: "none",
      internalDeliberation: consultation.deliberation,
      stateJson: serializeMasterState(consultation, "confirm_create"),
    };
  }

  const nextQuestion: Record<string, string> = {
    "naam klant": "Wat is de naam van de klant?",
    "e-mail of telefoon": "Wat is het e-mailadres of telefoonnummer?",
    "omschrijving aanvraag": "Kun je kort omschrijven wat de klant wil (fles, thema, aantal)?",
  };

  return {
    content: `Ik heb intern overlegd:\n\n${deliberationBlock}\n\nIk mis nog: **${missing[0]}**.\n\n${nextQuestion[missing[0]] ?? `Kun je ${missing[0]} doorgeven?`}`,
    questionType: "text",
    collectedData: consultation.lead,
    action: "none",
    internalDeliberation: consultation.deliberation,
    stateJson: serializeMasterState(consultation, "gathering"),
  };
}

export function serializeMasterState(
  consultation: {
    lead: CollectedLeadData;
    intent: string;
    pricingNote: string;
    contactDraft: string;
    workbonNote: string;
  },
  phase: MasterSessionState["phase"]
): string {
  return JSON.stringify({
    lead: consultation.lead,
    intent: consultation.intent,
    pricingNote: consultation.pricingNote,
    contactDraft: consultation.contactDraft,
    workbonNote: consultation.workbonNote,
    phase,
  } satisfies MasterSessionState);
}

export function isMasterPendingConfirmation(
  lastAssistantMessage: { questionType?: string | null; content: string } | null
): boolean {
  if (!lastAssistantMessage) return false;
  return (
    lastAssistantMessage.questionType === "yes_no" &&
    lastAssistantMessage.content.toLowerCase().includes("aanmaken")
  );
}
