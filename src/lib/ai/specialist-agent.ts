import { callOpenAiText } from "@/lib/ai";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-knowledge";

const FALLBACKS: Record<string, string> = {
  customer_contact: `Je bent de Klantcontact Agent voor Champagne is Art Studio.
Schrijf vriendelijke, professionele mails en WhatsApp-berichten in het Nederlands.
Houd antwoorden kort; vraag door als info ontbreekt.`,
  work_instruction: `Je bent de Werkbon Agent voor Champagne is Art Studio.
Vertaal klantwensen naar een heldere interne richtlijn voor de kunstenaar:
thema, kleuren, tekst op fles, voorkant/achterkant, logo's, stijl.`,
  pricing: `Je bent de Prijs Agent voor Champagne is Art Studio.
Bereken inkoop (fles + beschildering), verkoop excl./incl. BTW (21%), marge en totaal.`,
};

export async function processSpecialistAgentTurn(
  agentId: number,
  slug: string,
  userMessage: string,
  conversationContext?: string
): Promise<string> {
  const fallback = FALLBACKS[slug] ?? "Je bent een assistent voor Champagne is Art Studio.";
  const systemPrompt = await buildAgentSystemPrompt(agentId, fallback);

  const userPrompt = conversationContext
    ? `Eerdere berichten in dit gesprek:\n${conversationContext}\n\nNieuw bericht:\n${userMessage}`
    : userMessage;

  const answer = await callOpenAiText(systemPrompt, userPrompt, 700);
  if (answer) return answer.trim();

  return "Ik kon geen antwoord genereren. Controleer de OpenAI-koppeling in Instellingen.";
}

export function getSpecialistAgentGreeting(slug: string) {
  const labels: Record<string, string> = {
    customer_contact: "Klantcontact Agent",
    work_instruction: "Werkbon Agent",
  };
  const name = labels[slug] ?? "Agent";
  return {
    content: `Hoi! Ik ben de **${name}**. Ik gebruik je gekoppelde .md-kennis en eerdere correcties.\n\nStel een vraag of plak een klantbericht — nieuwe kennis via Kennisbank of AI Studio staat meteen klaar voor het volgende antwoord.`,
    questionType: "text" as const,
  };
}
