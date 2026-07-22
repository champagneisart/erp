"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  aiAgentProfiles,
  aiTrainingFiles,
  aiTrainingItems,
  appSettings,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertAdmin, assertStaff } from "@/lib/auth/permissions";
import {
  storeUploadedBytes,
} from "@/lib/actions/file-storage";
import { performOpenAiHealthCheck } from "@/lib/ai/health-check";
import {
  isTextKnowledgeFile,
  readTextFromBuffer,
  titleFromFileName,
} from "@/lib/knowledge/text-upload";
import { sanitizeUploadFileName } from "@/lib/knowledge/file-utils";

export async function upsertSetting(key: string, value: string) {
  const session = await auth();
  assertAdmin(session);

  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date().toISOString() },
    });

  revalidatePath("/settings");
}

export async function runOpenAiHealthCheckAction() {
  const session = await auth();
  assertAdmin(session);

  const result = await performOpenAiHealthCheck("manual");
  revalidatePath("/settings");
  return result;
}

export async function ensureDefaultAgents() {
  const defaults = [
    {
      slug: "pricing",
      name: "Prijs Agent",
      purpose: "Prijsberekeningen en offertevoorstel op basis van product, aantal en deadline.",
    },
    {
      slug: "customer_contact",
      name: "Klantcontact Agent",
      purpose: "Toont toon, maakt mails/WhatsApp-concepten en pakt statusvragen op.",
    },
    {
      slug: "lead_processing",
      name: "Aanvraag Agent",
      purpose: "Extraheert klant- en aanvraaggegevens uit vrije tekst.",
    },
    {
      slug: "work_instruction",
      name: "Werkbon Agent",
      purpose: "Vormt input om naar interne werkbon/richtlijn voor kunstenaars.",
    },
    {
      slug: "master",
      name: "Meester Agent",
      purpose:
        "Coördineert alle agents intern en geeft één antwoord met ja/nee-vragen en acties.",
    },
  ];

  for (const item of defaults) {
    await db
      .insert(aiAgentProfiles)
      .values(item)
      .onConflictDoNothing({ target: aiAgentProfiles.slug });
  }
}

export async function saveAgentPrompt(agentId: number, systemPrompt: string) {
  const session = await auth();
  assertStaff(session);

  await db
    .update(aiAgentProfiles)
    .set({ systemPrompt, updatedAt: new Date().toISOString() })
    .where(eq(aiAgentProfiles.id, agentId));

  revalidatePath("/ai-studio");
}

export async function addTrainingItem(data: {
  agentId?: number;
  title: string;
  category: string;
  content: string;
  source?: string;
}) {
  const session = await auth();
  assertStaff(session);

  await db.insert(aiTrainingItems).values({
    agentId: data.agentId ?? null,
    title: data.title,
    category: data.category,
    content: data.content,
    source: data.source ?? "manual",
  });

  revalidatePath("/ai-studio");
}

export async function uploadAiTrainingFile(formData: FormData) {
  const session = await auth();
  assertStaff(session);

  const titleInput = ((formData.get("title") as string) || "").trim();
  const agentIdRaw = formData.get("agentId") as string;
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Bestand is verplicht");

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const safeName = sanitizeUploadFileName(file.name || `upload-${Date.now()}.md`);
  const title = titleInput || titleFromFileName(file.name);

  let trainingItemId: number | null = null;

  if (isTextKnowledgeFile(safeName, mimeType)) {
    const content = readTextFromBuffer(bytes);
    const [item] = await db
      .insert(aiTrainingItems)
      .values({
        agentId: agentIdRaw ? Number(agentIdRaw) : null,
        title,
        category: "import",
        content,
        source: "file-upload",
      })
      .returning();
    trainingItemId = item.id;
  }

  try {
    const stored = await storeUploadedBytes(bytes, safeName, mimeType, "ai-studio");
    await db.insert(aiTrainingFiles).values({
      trainingItemId,
      title,
      agentId: agentIdRaw ? Number(agentIdRaw) : null,
      fileName: stored.fileName,
      fileUrl: stored.url,
      mimeType: stored.mimeType,
    });
  } catch (blobError) {
    if (!trainingItemId) {
      const message =
        blobError instanceof Error ? blobError.message : "Bestand uploaden mislukt";
      throw new Error(message);
    }
  }

  revalidatePath("/ai-studio");
}
