"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { aiAgentProfiles, aiTrainingItems, kbArticles, kbFiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";
import {
  storeUploadedBytes,
} from "@/lib/actions/file-storage";
import {
  isTextKnowledgeFile,
  readTextFromBuffer,
  titleFromFileName,
} from "@/lib/knowledge/text-upload";
import { sanitizeUploadFileName } from "@/lib/knowledge/file-utils";

export async function createKnowledgeArticle(data: {
  title: string;
  category: string;
  content: string;
  tags?: string;
}) {
  const session = await auth();
  assertStaff(session);

  const [article] = await db
    .insert(kbArticles)
    .values({
      title: data.title,
      category: data.category,
      content: data.content,
      tags: data.tags ?? null,
      updatedAt: new Date().toISOString(),
    })
    .returning();

  revalidatePath("/knowledge");
  return article;
}

export async function uploadKnowledgeFile(formData: FormData) {
  const session = await auth();
  assertStaff(session);

  const titleInput = ((formData.get("title") as string) || "").trim();
  const category = ((formData.get("category") as string) || "import").trim();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Bestand is verplicht");

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const safeName = sanitizeUploadFileName(file.name || `upload-${Date.now()}.md`);
  const title = titleInput || titleFromFileName(file.name);

  let articleId: number | null = null;

  if (isTextKnowledgeFile(safeName, mimeType)) {
    const content = readTextFromBuffer(bytes);
    const [article] = await db
      .insert(kbArticles)
      .values({
        title,
        category,
        content,
        tags: "import,markdown",
        updatedAt: new Date().toISOString(),
      })
      .returning();
    articleId = article.id;
  }

  try {
    const stored = await storeUploadedBytes(bytes, safeName, mimeType, "knowledge");
    await db.insert(kbFiles).values({
      articleId,
      title,
      fileName: stored.fileName,
      fileUrl: stored.url,
      mimeType: stored.mimeType,
    });
  } catch (blobError) {
    if (!articleId) {
      const message =
        blobError instanceof Error ? blobError.message : "Bestand uploaden mislukt";
      throw new Error(message);
    }
    // Tekst staat in kennisbank; blob-backup is optioneel op Vercel zonder Blob-store
  }

  revalidatePath("/knowledge");
}

/** Maakt een trainingsitem voor een agent op basis van een kennisbank-artikel. */
export async function linkKnowledgeArticleToAgent(formData: FormData) {
  const session = await auth();
  assertStaff(session);

  const articleId = Number(formData.get("articleId"));
  const agentId = Number(formData.get("agentId"));
  if (!articleId || !agentId) throw new Error("Artikel en agent zijn verplicht");

  const [article] = await db
    .select()
    .from(kbArticles)
    .where(eq(kbArticles.id, articleId))
    .limit(1);
  if (!article) throw new Error("Artikel niet gevonden");

  const [agent] = await db
    .select()
    .from(aiAgentProfiles)
    .where(eq(aiAgentProfiles.id, agentId))
    .limit(1);
  if (!agent) throw new Error("Agent niet gevonden");

  await db.insert(aiTrainingItems).values({
    agentId: agent.id,
    title: article.title,
    category: article.category,
    content: article.content,
    source: `kb:${article.id}`,
  });

  revalidatePath("/knowledge");
  revalidatePath("/ai-studio");
}

export async function listKnowledgeFiles() {
  return db.select().from(kbFiles).orderBy(desc(kbFiles.createdAt));
}

export async function listAgentsForKnowledge() {
  return db
    .select({ id: aiAgentProfiles.id, name: aiAgentProfiles.name })
    .from(aiAgentProfiles)
    .orderBy(aiAgentProfiles.name);
}
