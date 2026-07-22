import { buildAgentSystemPromptBySlug } from "@/lib/ai/agent-knowledge";
import { callOpenAiText } from "@/lib/ai";

const FALLBACK_PROMPT = `Je bent de Prijs Agent voor Champagne is Art Studio.
Bereken inkoop (fles + beschildering), verkoop excl./incl. BTW (21%), marge en totaal op basis van aantal.
Vraag ontbrekende info door (formaat, aantal, incl./excl. fles, merk).
Deel marge alleen intern.`;

export async function getPricingAgentSystemPrompt(): Promise<string> {
  return buildAgentSystemPromptBySlug("pricing", FALLBACK_PROMPT);
}

export async function consultPricingAgent(
  context: string,
  options?: { audience?: "internal" | "customer" }
): Promise<string> {
  const systemPrompt = await getPricingAgentSystemPrompt();
  const audience = options?.audience ?? "internal";

  const userPrompt = `Context / vraag:
${context}

Geef een korte, concrete prijsberekening in het Nederlands.
- Splits inkoop in fles + beschildering waar relevant
- Noem excl. én incl. BTW (21%)
- Geef per fles én totaal als aantal > 1
- Vraag door als formaat, aantal of incl./excl. fles ontbreekt
- Doelgroep: ${audience === "internal" ? "medewerker (marge mag intern)" : "klant (geen marge tonen)"}`;

  const aiAnswer = await callOpenAiText(systemPrompt, userPrompt, 700);
  if (aiAnswer) return aiAnswer.trim();

  if (!systemPrompt || systemPrompt === FALLBACK_PROMPT) {
    return "Prijs Agent heeft nog geen prijstabellen. Plak je systeemprompt bij AI Studio → Prijs Agent en test opnieuw.";
  }

  return "Prijs Agent kon geen berekening maken. Controleer OpenAI-koppeling in Instellingen.";
}

export function getPricingAgentGreeting() {
  return {
    content:
      "Hoi! Ik ben de **Prijs Agent**. Vraag bijvoorbeeld:\n\n- Wat kost 6 standaardflessen 0,75L incl. fles?\n- Inkoop + marge op Ruinart 0,75L Blanc de Blancs\n- 3× Veuve Clicquot 1,5L beschilderd\n\nIk gebruik je prijstabellen uit AI Studio.",
    questionType: "text" as const,
  };
}

export async function processPricingAgentTurn(userMessage: string): Promise<string> {
  return consultPricingAgent(userMessage, { audience: "internal" });
}
