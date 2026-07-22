import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/db/schema";

/** Chat/completion — wat agents nu gebruiken */
export const OPENAI_CHAT_MODELS = [
  { id: "gpt-4o-mini", label: "gpt-4o-mini (aanbevolen, goedkoop)" },
  { id: "gpt-4o", label: "gpt-4o (slimmer, duurder)" },
  { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
  { id: "gpt-4.1", label: "gpt-4.1" },
] as const;

/** Embeddings — voor zoeken/RAG (nog niet actief in deze app) */
export const OPENAI_EMBEDDING_MODELS = [
  { id: "text-embedding-3-small", label: "text-embedding-3-small (1536d) — default, goedkoop" },
  { id: "text-embedding-3-large", label: "text-embedding-3-large (3072d) — nauwkeuriger" },
] as const;

export type OpenAiChatModelId = (typeof OPENAI_CHAT_MODELS)[number]["id"];
export type OpenAiEmbeddingModelId = (typeof OPENAI_EMBEDDING_MODELS)[number]["id"];

const DEFAULT_CHAT_MODEL: OpenAiChatModelId = "gpt-4o-mini";
const DEFAULT_EMBEDDING_MODEL: OpenAiEmbeddingModelId = "text-embedding-3-small";

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return row?.value?.trim() || null;
}

export async function getOpenAiKey(): Promise<string | null> {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim();
  return getSetting("openai_api_key");
}

export async function getOpenAiChatModel(): Promise<string> {
  const fromEnv = process.env.OPENAI_MODEL?.trim();
  if (fromEnv) return fromEnv;
  const fromDb = await getSetting("openai_chat_model");
  if (fromDb) return fromDb;
  return DEFAULT_CHAT_MODEL;
}

/** Opgeslagen voor toekomstige kennisbank-RAG; nog geen vector search in productie. */
export async function getOpenAiEmbeddingModel(): Promise<string> {
  const fromEnv = process.env.OPENAI_EMBEDDING_MODEL?.trim();
  if (fromEnv) return fromEnv;
  const fromDb = await getSetting("openai_embedding_model");
  if (fromDb) return fromDb;
  return DEFAULT_EMBEDDING_MODEL;
}

export function isOpenAiKeyFromEnv(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
