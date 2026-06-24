"use server";

import { desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { kbArticles, kbFiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";
import { storeUploadedFile } from "@/lib/actions/file-storage";

export async function createKnowledgeArticle(data: {
  title: string;
  category: string;
  content: string;
  tags?: string;
}) {
  const session = await auth();
  assertStaff(session);

  await db.insert(kbArticles).values({
    title: data.title,
    category: data.category,
    content: data.content,
    tags: data.tags ?? null,
    updatedAt: new Date().toISOString(),
  });

  revalidatePath("/knowledge");
}

export async function uploadKnowledgeFile(formData: FormData) {
  const session = await auth();
  assertStaff(session);

  const title = ((formData.get("title") as string) || "").trim();
  const file = formData.get("file") as File | null;
  if (!title) throw new Error("Titel is verplicht");
  if (!file) throw new Error("Bestand is verplicht");

  const stored = await storeUploadedFile(file, "knowledge");
  await db.insert(kbFiles).values({
    title,
    fileName: stored.fileName,
    fileUrl: stored.url,
    mimeType: stored.mimeType,
  });

  revalidatePath("/knowledge");
}

export async function listKnowledgeFiles() {
  return db.select().from(kbFiles).orderBy(desc(kbFiles.createdAt));
}
