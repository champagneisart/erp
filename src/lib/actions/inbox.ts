"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { messageDrafts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";
import { createInboxEntryWithDraft, regenerateLeadMailDraft } from "@/lib/ai/inbox-draft";

export async function createInboundMessage(data: {
  body: string;
  subject?: string;
  channel?: string;
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  leadId?: number;
  leadTitle?: string;
  orderId?: number;
}) {
  const session = await auth();
  assertStaff(session);

  const msg = await createInboxEntryWithDraft({
    body: data.body,
    subject: data.subject,
    channel: data.channel ?? "manual",
    customerId: data.customerId,
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    leadId: data.leadId,
    leadTitle: data.leadTitle,
    orderId: data.orderId,
  });

  revalidatePath("/inbox");
  revalidatePath("/leads");
  return { message: msg };
}

export async function approveDraft(draftId: number) {
  const session = await auth();
  assertStaff(session);

  await db
    .update(messageDrafts)
    .set({ approved: true })
    .where(eq(messageDrafts.id, draftId));

  revalidatePath("/inbox");
  revalidatePath("/leads");
}

export async function regenerateMailDraftForLead(
  leadId: number,
  context: {
    customerName?: string;
    customerEmail?: string;
    leadTitle?: string;
  }
) {
  const session = await auth();
  assertStaff(session);

  await regenerateLeadMailDraft(leadId, context);

  revalidatePath("/inbox");
  revalidatePath(`/leads/${leadId}`);
}
