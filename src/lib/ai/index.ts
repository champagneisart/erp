import { eq, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings, kbArticles } from "@/db/schema";
import { parseInquiryText, parsedToLeadFields } from "@/lib/ai/parse-inquiry";

export type MessageClassification =
  | "new_lead"
  | "additional_info"
  | "approval"
  | "status_question"
  | "change_request"
  | "complaint"
  | "urgent"
  | "invoice"
  | "payment_reminder"
  | "unknown";

const KEYWORDS: Record<MessageClassification, string[]> = {
  new_lead: [
    "offerte",
    "aanvraag",
    "bestellen",
    "interesse",
    "prijsopgave",
    "prijsindicatie",
    "proefdesign",
    "proef design",
    "quote",
    "personalis",
    "gepersonaliseerd",
    "fles champagne",
    "champagne",
  ],
  additional_info: ["bijlage", "logo", "tekst", "info", "aanvullend"],
  approval: ["akkoord", "goedkeur", "prima"],
  status_question: ["status", "hoe ver", "wanneer", "klaar"],
  change_request: ["wijzig", "aanpassen", "ander"],
  complaint: ["klacht", "teleurgesteld", "fout", "mis"],
  urgent: ["spoed", "dringend", "asap", "snel"],
  invoice: ["factuur", "invoice"],
  payment_reminder: ["betaling", "betalen", "herinnering"],
  unknown: [],
};

async function getOpenAiKey(): Promise<string | null> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "openai_api_key"))
    .limit(1);
  return setting?.value ?? null;
}

async function callOpenAi(
  systemPrompt: string,
  userPrompt: string,
  options?: { json?: boolean; maxTokens?: number }
): Promise<string | null> {
  const apiKey = await getOpenAiKey();
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.05,
      max_tokens: options?.maxTokens ?? 900,
      ...(options?.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

async function callOpenAiJson<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T | null> {
  const content = await callOpenAi(systemPrompt, userPrompt, { json: true });
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function callOpenAiText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 900
): Promise<string | null> {
  return callOpenAi(systemPrompt, userPrompt, { maxTokens });
}

function mergeField<T>(local: T | null, ai: T | undefined | null): T | null {
  if (local !== null && local !== undefined && local !== "") return local;
  if (ai !== undefined && ai !== null && ai !== "") return ai as T;
  return local;
}

export async function classifyIncomingMessage(text: string): Promise<{
  type: MessageClassification;
  confidence: number;
}> {
  const parsed = parseInquiryText(text);
  if (parsed.wantsQuote || parsed.requests.length > 0) {
    return { type: "new_lead", confidence: 0.9 };
  }

  const ai = await callOpenAiJson<{ type: MessageClassification; confidence?: number }>(
    "Classificeer inkomende klantberichten voor een champagne personalisatie studio. Geef JSON: type, confidence. Types: new_lead, additional_info, approval, status_question, change_request, complaint, urgent, invoice, payment_reminder, unknown.",
    text
  );
  if (ai?.type) {
    return { type: ai.type, confidence: ai.confidence ?? 0.85 };
  }

  const lower = text.toLowerCase();
  for (const [type, words] of Object.entries(KEYWORDS) as [
    MessageClassification,
    string[],
  ][]) {
    if (type === "unknown") continue;
    if (words.some((w) => lower.includes(w))) {
      return { type, confidence: 0.8 };
    }
  }
  return { type: "unknown", confidence: 0.3 };
}

const EXTRACT_SYSTEM_PROMPT = `Je bent een data-extractie assistent voor Champagne is Art Studio.
Parse inkomende e-mails, WhatsApp-berichten en aanvraagformulieren naar JSON.

Velden:
- name: volledige naam afzender (uit handtekening)
- company: bedrijfsnaam (uit e-maildomein of handtekening)
- email: e-mailadres
- phone: telefoonnummer (normaliseer spaties)
- title: korte titel van de aanvraag (1 zin)
- description: samenvatting van wat de klant wil, inclusief thema, tekst op fles, logo, aantal
- theme: thema (bijv. onboarding, premium, jubileum)
- bottle_text: exacte tekst die op de fles moet
- wants_quote: true als ze prijsopgave/offerte willen
- wants_proof_design: true als ze proefdesign/mockup willen
- quantity: aantal flessen als genoemd (null anders)
- source: email|whatsapp|website|manual
- missing_fields: array van ontbrekende velden

Voorbeeld input: e-mail van Derk van Dijk over gepersonaliseerde champagne voor onboarding met logo en prijsopgave + proefdesign.
Output moet name=Derk van Dijk, company=Celebratix, email=derk@celebratix.io, phone=+31 6 38 12 83 69, wants_quote=true, wants_proof_design=true, theme=onboarding nieuwe klanten.`;

export async function extractLeadData(text: string) {
  const local = parsedToLeadFields(parseInquiryText(text));

  const ai = await callOpenAiJson<{
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    title?: string;
    description?: string;
    theme?: string;
    bottle_text?: string;
    wants_quote?: boolean;
    wants_proof_design?: boolean;
    quantity?: number;
    source?: string;
    missing_fields?: string[];
  }>(EXTRACT_SYSTEM_PROMPT, text);

  const merged = {
    name: mergeField(local.name, ai?.name),
    company: mergeField(local.company, ai?.company),
    email: mergeField(local.email, ai?.email),
    phone: mergeField(local.phone, ai?.phone),
    title: mergeField(local.title, ai?.title),
    description: mergeField(local.description, ai?.description) ?? text,
    source: ai?.source ?? local.source ?? "manual",
    theme: mergeField(local.theme, ai?.theme),
    bottleText: mergeField(local.bottleText, ai?.bottle_text),
    wantsQuote: ai?.wants_quote ?? local.requests?.includes("prijsopgave") ?? false,
    wantsProofDesign:
      ai?.wants_proof_design ?? local.requests?.includes("proefdesign") ?? false,
    quantity: ai?.quantity ?? null,
    missing_fields: local.missing_fields,
  };

  return merged;
}

export async function generateCustomerReply(context: {
  messageBody: string;
  classification: string;
}): Promise<string> {
  const parsed = parseInquiryText(context.messageBody);
  const naam = parsed.name?.split(" ")[0] ?? "klant";

  const articles = await db
    .select()
    .from(kbArticles)
    .where(
      or(
        like(kbArticles.category, "%tone%"),
        like(kbArticles.category, "%faq%")
      )
    )
    .limit(3);

  const tone =
    articles[0]?.content?.slice(0, 200) ??
    "Vriendelijk en professioneel, Champagne is Art Studio.";

  const extras: string[] = [];
  if (parsed.wantsQuote) extras.push("we werken een prijsopgave voor je uit");
  if (parsed.wantsProofDesign) extras.push("we kunnen een proefdesign opstellen");

  return `Beste ${naam},\n\nBedankt voor je aanvraag${
    parsed.theme ? ` over ${parsed.theme.toLowerCase()}` : ""
  }. ${extras.length > 0 ? extras.join(" en ") + "." : ""}\n\n${tone}\n\nMet vriendelijke groet,\nChampagne is Art Studio`;
}

export async function checkMissingOrderInfo(order: {
  theme?: string | null;
  bottleFormat?: string | null;
  deadline?: string | null;
}) {
  const missing: string[] = [];
  if (!order.theme) missing.push("thema");
  if (!order.bottleFormat) missing.push("formaat");
  if (!order.deadline) missing.push("deadline");
  return missing;
}

export async function suggestNextTask(context: {
  entity: "lead" | "order";
  status: string;
}): Promise<string | null> {
  if (context.entity === "lead" && context.status === "missing_info") {
    return "Klant benaderen voor ontbrekende informatie";
  }
  if (context.entity === "order" && context.status === "guideline_draft") {
    return "Richtlijn controleren en naar klant sturen";
  }
  if (context.entity === "order" && context.status === "scheduled") {
    return "Kunstenaar bevestigen en startdatum communiceren";
  }
  return null;
}

export async function generateWorkInstructionFromText(text: string) {
  const parsed = parseInquiryText(text);
  return {
    theme: parsed.theme ?? parsed.title ?? text.slice(0, 120),
    textContent: parsed.bottleText ?? parsed.description ?? text,
    style: parsed.requests.includes("gepersonaliseerde fles")
      ? "Premium gepersonaliseerd"
      : "Te bepalen door ontwerper",
    logosNotes: parsed.requests.includes("logo") ? "Logo van klant toevoegen" : undefined,
  };
}
