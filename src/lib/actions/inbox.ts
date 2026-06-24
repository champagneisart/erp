"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { messages, messageDrafts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";
import {
  classifyIncomingMessage,
  generateCustomerReply,
} from "@/lib/ai";

export async function createInboundMessage(data: {
  body: string;
  subject?: string;
  channel?: string;
  customerId?: number;
  leadId?: number;
  orderId?: number;
}) {
  const session = await auth();
  assertStaff(session);

  const classification = await classifyIncomingMessage(data.body);

  const [msg] = await db
    .insert(messages)
    .values({
      body: data.body,
      subject: data.subject ?? null,
      channel: data.channel ?? "manual",
      customerId: data.customerId ?? null,
      leadId: data.leadId ?? null,
      orderId: data.orderId ?? null,
      classification: classification.type,
    })
    .returning();

  const draftBody = await generateCustomerReply({
    messageBody: data.body,
    classification: classification.type,
  });

  await db.insert(messageDrafts).values({
    messageId: msg.id,
    body: draftBody,
  });

  revalidatePath("/inbox");
  return { message: msg, classification, draftBody };
}

export async function approveDraft(draftId: number) {
  const session = await auth();
  assertStaff(session);

  await db
    .update(messageDrafts)
    .set({ approved: true })
    .where(eq(messageDrafts.id, draftId));

  revalidatePath("/inbox");
}
