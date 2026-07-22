import { parseInquiryText } from "@/lib/ai/parse-inquiry";
import { callOpenAiText, generateCustomerReply } from "@/lib/ai";
import { buildAgentSystemPrompt, getAgentBySlug } from "@/lib/ai/agent-knowledge";
import { consultPricingAgent } from "@/lib/ai/pricing-agent";

const FALLBACK_PROMPT = `Je bent de Klantcontact Agent voor Champagne is Art Studio.
Je schrijft professionele, warme e-mails in het Nederlands (u-vorm).
Geen jargon; wel concreet. Geen interne marges of inkoopprijzen naar de klant tenzij expliciet gevraagd om een indicatie.
Output ALLEEN de e-mailtekst — geen stijlinstructies, geen meta-uitleg, geen markdown.`;

export type DeliberationNote = { agent: string; note: string };

export type CustomerContactDraftResult = {
  deliberation: DeliberationNote[];
  emailDraft: string;
};

function missingForReply(body: string): string[] {
  const parsed = parseInquiryText(body);
  const missing: string[] = [];
  if (!parsed.name) missing.push("naam klant");
  if (!parsed.email && !parsed.phone) missing.push("e-mail of telefoon");
  if (!parsed.theme && !parsed.description && body.length < 40) {
    missing.push("duidelijke omschrijving wens");
  }
  return missing;
}

/** Klantcontact-agent: intern conclaaf + mailopzet voor inbox/aanvragen. */
export async function draftCustomerContactReply(context: {
  messageBody: string;
  classification: string;
  customerName?: string;
  customerEmail?: string;
  subject?: string;
  leadTitle?: string;
}): Promise<CustomerContactDraftResult> {
  const parsed = parseInquiryText(context.messageBody);
  const deliberation: DeliberationNote[] = [];
  const naam = context.customerName ?? parsed.name ?? "klant";
  const missing = missingForReply(context.messageBody);

  deliberation.push({
    agent: "Klantcontact Agent",
    note: [
      `Intentie: ${context.classification}.`,
      context.leadTitle ? `Aanvraag: ${context.leadTitle}.` : null,
      context.subject ? `Onderwerp: ${context.subject}.` : null,
      `Klant: ${naam}${context.customerEmail ? ` (${context.customerEmail})` : ""}.`,
      parsed.wantsQuote ? "Wil prijsopgave/indicatie." : null,
      parsed.wantsProofDesign ? "Wil proefdesign." : null,
      missing.length ? `Nog nodig: ${missing.join(", ")}.` : "Kerninfo lijkt compleet.",
    ]
      .filter(Boolean)
      .join(" "),
  });

  const wantsPricing =
    parsed.wantsQuote ||
    context.classification === "new_lead" ||
    /prijs|offerte|indicatie|kost/i.test(context.messageBody);

  if (wantsPricing) {
    try {
      const pricingNote = await consultPricingAgent(context.messageBody, {
        audience: "customer",
      });
      deliberation.push({
        agent: "Prijs Agent",
        note: pricingNote.slice(0, 800),
      });
    } catch {
      deliberation.push({
        agent: "Prijs Agent",
        note: "Geen prijsindicatie beschikbaar (OpenAI of prijstabellen ontbreken).",
      });
    }
  }

  deliberation.push({
    agent: "Conclaaf",
    note:
      missing.length > 0
        ? `Besluit: vriendelijk bedanken + doorvragen naar ${missing.join(", ")}. Geen definitieve prijsbelofte zonder complete specs.`
        : "Besluit: bevestigen ontvangst, korte samenvatting, volgende stap (offerte/ontwerp/planning) voorstellen.",
  });

  const agent = await getAgentBySlug("customer_contact");
  const systemPrompt = agent
    ? await buildAgentSystemPrompt(agent.id, FALLBACK_PROMPT)
    : FALLBACK_PROMPT;

  const internalBrief = deliberation
    .map((d) => `**${d.agent}:** ${d.note}`)
    .join("\n\n");

  const voornaam = naam.split(" ")[0] ?? "klant";

  const userPrompt = `## Inkomend bericht / aanvraag
${context.messageBody}

## Intern conclaaf (niet copy-pasten naar klant)
${internalBrief}

## Opdracht
Schrijf één complete e-mail aan ${naam}.
- Nederlands, u-vorm, professioneel-warm (Champagne is Art Studio)
- Bedank voor de aanvraag; spiegel kort de wens in eigen woorden
- Als info ontbreekt: stel max. 3 concrete vragen
- Als prijs relevant: geef voorzichtige indicatie of beloof uitwerking (geen verzonnen bedragen)
- Sluit af met "Met vriendelijke groet,\\nChampagne is Art Studio"
- Gebruik een persoonlijke aanhef${voornaam !== "klant" ? ` ("Beste ${voornaam},")` : " (bij onbekende naam: Beste heer/mevrouw,)"}
- Alleen de mailtekst — geen kopjes, bullets over stijl, of uitleg eromheen`;

  const aiDraft = await callOpenAiText(systemPrompt, userPrompt, 900);

  if (aiDraft?.trim() && !looksLikeInstructionLeak(aiDraft)) {
    return { deliberation, emailDraft: aiDraft.trim() };
  }

  if (aiDraft?.trim()) {
    deliberation.push({
      agent: "Systeem",
      note: "AI-output bevatte stijlinstructies — template-fallback gebruikt.",
    });
  } else {
    deliberation.push({
      agent: "Systeem",
      note: "OpenAI niet beschikbaar of lege reactie — template-fallback gebruikt. Controleer OPENAI_API_KEY in Instellingen.",
    });
  }

  const fallback = await generateCustomerReply({
    messageBody: context.messageBody,
    classification: context.classification,
  });

  return { deliberation, emailDraft: fallback };
}

/** Voorkom dat tone-of-voice richtlijnen letterlijk in de mail belanden. */
function looksLikeInstructionLeak(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /gebruik u-vorm|tone of voice|warm, professioneel|kort en duidelijk/i.test(lower) &&
    !/hartelijk dank|met vriendelijke groet/i.test(lower.slice(0, 120))
  );
}

export function serializeDraftStorage(result: CustomerContactDraftResult): {
  body: string;
  internalNotes: string;
} {
  return {
    body: result.emailDraft,
    internalNotes: JSON.stringify(result.deliberation),
  };
}

export function parseDraftDeliberation(
  internalNotes: string | null | undefined
): DeliberationNote[] {
  if (!internalNotes) return [];
  try {
    const parsed = JSON.parse(internalNotes) as DeliberationNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
