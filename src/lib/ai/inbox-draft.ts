import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messageDrafts, messages } from "@/db/schema";
import {
  classifyIncomingMessage,
  type MessageClassification,
} from "@/lib/ai";
import {
  draftCustomerContactReply,
  serializeDraftStorage,
} from "@/lib/ai/customer-contact-agent";

export async function createInboxEntryWithDraft(params: {
  body: string;
  subject?: string;
  channel: string;
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  leadId?: number;
  leadTitle?: string;
  orderId?: number;
}) {
  let classification: { type: MessageClassification; confidence?: number } = {
    type: "unknown",
  };
  let draftStorage: { body: string; internalNotes: string } | null = null;

  try {
    classification = await classifyIncomingMessage(params.body);
    const draft = await draftCustomerContactReply({
      messageBody: params.body,
      classification: classification.type,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      subject: params.subject,
      leadTitle: params.leadTitle,
    });
    draftStorage = serializeDraftStorage(draft);
  } catch {
    // Inbox werkt ook zonder OpenAI
  }

  const [msg] = await db
    .insert(messages)
    .values({
      body: params.body,
      subject: params.subject ?? null,
      channel: params.channel,
      customerId: params.customerId ?? null,
      leadId: params.leadId ?? null,
      orderId: params.orderId ?? null,
      classification: classification.type,
    })
    .returning();

  if (draftStorage) {
    await db.insert(messageDrafts).values({
      messageId: msg.id,
      body: draftStorage.body,
      internalNotes: draftStorage.internalNotes,
    });
  }

  return msg;
}

export async function getLeadMailDraft(leadId: number) {
  const [row] = await db
    .select({ message: messages, draft: messageDrafts })
    .from(messages)
    .leftJoin(messageDrafts, eq(messageDrafts.messageId, messages.id))
    .where(eq(messages.leadId, leadId))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  if (!row?.draft) return null;
  return row;
}

export async function regenerateLeadMailDraft(
  leadId: number,
  context: {
    customerName?: string;
    customerEmail?: string;
    leadTitle?: string;
  }
) {
  const row = await getLeadMailDraft(leadId);
  if (!row?.draft) return null;

  const draft = await draftCustomerContactReply({
    messageBody: row.message.body,
    classification: row.message.classification ?? "new_lead",
    customerName: context.customerName,
    customerEmail: context.customerEmail,
    subject: row.message.subject ?? undefined,
    leadTitle: context.leadTitle,
  });
  const storage = serializeDraftStorage(draft);

  await db
    .update(messageDrafts)
    .set({
      body: storage.body,
      internalNotes: storage.internalNotes,
      approved: false,
    })
    .where(eq(messageDrafts.id, row.draft.id));

  return storage;
}
