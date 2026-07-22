import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgentProfiles, aiTrainingItems } from "@/db/schema";
import { truncateForPrompt } from "@/lib/knowledge/text-upload";

const MAX_CORRECTIONS = 5;
const MAX_KNOWLEDGE_ITEMS = 8;
const MAX_CHARS_PER_ITEM = 4000;

export async function getAgentBySlug(slug: string) {
  const [agent] = await db
    .select()
    .from(aiAgentProfiles)
    .where(eq(aiAgentProfiles.slug, slug))
    .limit(1);
  return agent ?? null;
}

/** System prompt = basis + kennis (.md) + correcties uit feedback */
export async function buildAgentSystemPrompt(
  agentId: number,
  fallbackPrompt: string
): Promise<string> {
  const [agent] = await db
    .select()
    .from(aiAgentProfiles)
    .where(eq(aiAgentProfiles.id, agentId))
    .limit(1);

  const base = agent?.systemPrompt?.trim() || fallbackPrompt;

  const items = await db
    .select()
    .from(aiTrainingItems)
    .where(eq(aiTrainingItems.agentId, agentId))
    .orderBy(desc(aiTrainingItems.createdAt))
    .limit(MAX_CORRECTIONS + MAX_KNOWLEDGE_ITEMS + 5);

  const corrections = items.filter((i) => i.category === "correctie").slice(0, MAX_CORRECTIONS);
  const knowledge = items.filter((i) => i.category !== "correctie").slice(0, MAX_KNOWLEDGE_ITEMS);

  const blocks: string[] = [];

  if (corrections.length > 0) {
    blocks.push(
      "## Geleerde correcties (geef hier voorrang aan)\n" +
        corrections
          .map(
            (item) =>
              `### ${item.title}\n${truncateForPrompt(item.content, MAX_CHARS_PER_ITEM)}`
          )
          .join("\n\n")
    );
  }

  if (knowledge.length > 0) {
    blocks.push(
      "## Kennisbank & trainingsdata\n" +
        knowledge
          .map(
            (item) =>
              `### ${item.title} (${item.category})\n${truncateForPrompt(item.content, MAX_CHARS_PER_ITEM)}`
          )
          .join("\n\n")
    );
  }

  if (blocks.length === 0) return base;

  return `${base}\n\n---\n\n${blocks.join("\n\n")}`;
}

export async function buildAgentSystemPromptBySlug(
  slug: string,
  fallbackPrompt: string
): Promise<string> {
  const agent = await getAgentBySlug(slug);
  if (!agent) return fallbackPrompt;
  return buildAgentSystemPrompt(agent.id, fallbackPrompt);
}
