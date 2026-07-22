"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { aiTrainingItems } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";

/** Slaat een correctie op als trainingsdata — agent gebruikt dit bij volgende antwoorden. */
export async function teachAgentFromCorrection(data: {
  agentId: number;
  wrongAnswer: string;
  correctAnswer: string;
  context?: string;
}) {
  const session = await auth();
  assertStaff(session);

  const wrong = data.wrongAnswer.trim();
  const correct = data.correctAnswer.trim();
  if (!wrong || !correct) {
    throw new Error("Vul in wat fout was en wat het juiste antwoord is");
  }

  const date = new Date().toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  await db.insert(aiTrainingItems).values({
    agentId: data.agentId,
    title: `Correctie ${date}`,
    category: "correctie",
    content: [
      "Medewerker corrigeerde een eerdere agent-reactie.",
      "",
      "**Fout antwoord:**",
      wrong,
      "",
      "**Juiste aanpak:**",
      correct,
      data.context?.trim() ? `\n**Context:**\n${data.context.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    source: "user-feedback",
  });

  revalidatePath("/ai-studio");
  revalidatePath("/agent-chat");
  revalidatePath("/knowledge");
}
