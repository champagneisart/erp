import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  customers,
  leads,
  messages,
  messageDrafts,
  orders,
  tasks,
  workInstructions,
} from "@/db/schema";
import { logActivity } from "@/lib/actions/log";
import {
  classifyIncomingMessage,
  generateCustomerReply,
  type MessageClassification,
} from "@/lib/ai";
import type { NormalizedFormData } from "@/lib/webhooks/parse-form-payload";

async function findOrCreateCustomer(data: {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
}) {
  if (data.email) {
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, data.email))
      .limit(1);
    if (existing) return existing;
  }

  const [created] = await db
    .insert(customers)
    .values({
      name: data.name ?? "Website bezoeker",
      company: data.company ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
    })
    .returning();

  return created;
}

async function resolveOrder(data: Pick<NormalizedFormData, "orderNumber" | "email">) {
  if (data.orderNumber) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, data.orderNumber.trim()))
      .limit(1);
    if (order) return order;
  }

  if (data.email) {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, data.email))
      .limit(1);
    if (!customer) return null;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customer.id))
      .orderBy(desc(orders.createdAt))
      .limit(1);
    return order ?? null;
  }

  return null;
}

async function createInboxEntry(params: {
  body: string;
  subject?: string;
  channel: string;
  customerId?: number;
  leadId?: number;
  orderId?: number;
}) {
  let classification: { type: MessageClassification; confidence?: number } = {
    type: "unknown",
  };
  let draftBody: string | null = null;

  try {
    classification = await classifyIncomingMessage(params.body);
    draftBody = await generateCustomerReply({
      messageBody: params.body,
      classification: classification.type,
    });
  } catch {
    // AI optioneel — inbox werkt ook zonder OpenAI
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

  if (draftBody) {
    await db.insert(messageDrafts).values({
      messageId: msg.id,
      body: draftBody,
    });
  }

  return msg;
}

function buildRawPayload(data: NormalizedFormData) {
  return JSON.stringify(data.raw, null, 2);
}

function buildDescription(data: NormalizedFormData) {
  const parts: string[] = [];
  if (data.message) parts.push(data.message);
  if (data.subject) parts.push(`Onderwerp: ${data.subject}`);

  for (const [key, value] of Object.entries(data.extra)) {
    parts.push(`${key.replace(/_/g, " ")}: ${value}`);
  }

  return parts.join("\n\n").trim() || "Inzending via website";
}

function workInstructionFromForm(data: NormalizedFormData) {
  const extraNotes =
    Object.keys(data.extra).length > 0
      ? Object.entries(data.extra)
          .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
          .join("\n")
      : undefined;

  return {
    theme: data.theme ?? data.title,
    colorScheme: data.colorScheme,
    textContent: data.textContent ?? data.message,
    frontDesign: data.frontDesign,
    backDesign: data.backDesign,
    style: data.style,
    logosNotes: data.logosNotes,
    visualElements: data.visualElements,
    attachmentsNotes: [data.attachmentsNotes, extraNotes].filter(Boolean).join("\n\n") || undefined,
  };
}

async function upsertWorkInstructionForOrder(
  orderId: number,
  data: NormalizedFormData
) {
  const wi = workInstructionFromForm(data);
  const [existing] = await db
    .select()
    .from(workInstructions)
    .where(eq(workInstructions.orderId, orderId))
    .limit(1);

  if (existing) {
    await db
      .update(workInstructions)
      .set({ ...wi, updatedAt: new Date().toISOString() })
      .where(eq(workInstructions.orderId, orderId));
  } else {
    await db.insert(workInstructions).values({ orderId, ...wi });
  }

  if (data.theme) {
    await db
      .update(orders)
      .set({ theme: data.theme, updatedAt: new Date().toISOString() })
      .where(eq(orders.id, orderId));
  }

  if (data.deadline) {
    await db
      .update(orders)
      .set({ deadline: data.deadline, updatedAt: new Date().toISOString() })
      .where(eq(orders.id, orderId));
  }
}

export async function processContactForm(data: NormalizedFormData) {
  const customer = await findOrCreateCustomer(data);
  const leadTitle =
    data.title ??
    data.subject ??
    (data.formName ? `Contact: ${data.formName}` : "Contact via website");

  const [lead] = await db
    .insert(leads)
    .values({
      customerId: customer.id,
      source: "website",
      title: leadTitle,
      description: buildDescription(data),
      rawPayload: buildRawPayload(data),
      status: "new",
    })
    .returning();

  const msg = await createInboxEntry({
    body: buildDescription(data),
    subject: data.subject ?? "Contactformulier website",
    channel: "website_contact",
    customerId: customer.id,
    leadId: lead.id,
  });

  await logActivity({
    entityType: "lead",
    entityId: lead.id,
    action: "webhook_contact",
    toValue: "website",
  });

  return {
    formType: "contact" as const,
    leadId: lead.id,
    customerId: customer.id,
    messageId: msg.id,
  };
}

export async function processAanvraagForm(data: NormalizedFormData) {
  const customer = await findOrCreateCustomer(data);
  const leadTitle =
    data.title ??
    data.subject ??
    data.formName ??
    "Nieuwe aanvraag via website";

  const [lead] = await db
    .insert(leads)
    .values({
      customerId: customer.id,
      source: "website",
      title: leadTitle,
      description: buildDescription(data),
      rawPayload: buildRawPayload(data),
      status: "new",
    })
    .returning();

  await db.insert(tasks).values({
    title: "Nieuwe website-aanvraag beoordelen",
    description: `${customer.name}${data.email ? ` (${data.email})` : ""} — ${lead.title}`,
    leadId: lead.id,
    priority: "high",
    isAutomatic: true,
  });

  await createInboxEntry({
    body: buildDescription(data),
    subject: data.title ?? "Aanvraag via website",
    channel: "website_aanvraag",
    customerId: customer.id,
    leadId: lead.id,
  });

  await logActivity({
    entityType: "lead",
    entityId: lead.id,
    action: "webhook_aanvraag",
    toValue: "website",
  });

  return {
    formType: "aanvraag" as const,
    leadId: lead.id,
    customerId: customer.id,
  };
}

export async function processOntwerpdetailsForm(data: NormalizedFormData) {
  const order = await resolveOrder(data);

  if (order) {
    await upsertWorkInstructionForOrder(order.id, data);

    await db.insert(tasks).values({
      title: "Ontwerpdetails ontvangen — werkbon controleren",
      description: `Order ${order.orderNumber} — formulier ingevuld via website`,
      orderId: order.id,
      priority: "high",
      isAutomatic: true,
    });

    await logActivity({
      entityType: "order",
      entityId: order.id,
      action: "webhook_ontwerpdetails",
      toValue: "website",
    });

    return {
      formType: "ontwerpdetails" as const,
      orderId: order.id,
      orderNumber: order.orderNumber,
      linked: "order" as const,
    };
  }

  const customer = data.email ? await findOrCreateCustomer(data) : null;

  let leadId: number | null = null;
  if (customer) {
    const [recentLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.customerId, customer.id))
      .orderBy(desc(leads.createdAt))
      .limit(1);

    if (recentLead) {
      leadId = recentLead.id;
      await db
        .update(leads)
        .set({
          description: `${recentLead.description ?? ""}\n\n--- Ontwerpdetails (wacht op order) ---\n${buildDescription(data)}`.trim(),
          rawPayload: buildRawPayload(data),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(leads.id, recentLead.id));
    } else {
      const [lead] = await db
        .insert(leads)
        .values({
          customerId: customer.id,
          source: "website",
          title: "Ontwerpdetails (nog geen order)",
          description: buildDescription(data),
          rawPayload: buildRawPayload(data),
          status: "new",
        })
        .returning();
      leadId = lead.id;
    }
  }

  await db.insert(tasks).values({
    title: "Ontwerpdetails — koppel aan order",
    description: [
      data.orderNumber ? `Ordernummer: ${data.orderNumber}` : null,
      data.email ? `E-mail: ${data.email}` : null,
      data.name ? `Naam: ${data.name}` : null,
      "Formulier ontvangen maar geen order gevonden. Handmatig koppelen.",
    ]
      .filter(Boolean)
      .join("\n"),
    leadId: leadId ?? undefined,
    priority: "high",
    isAutomatic: true,
  });

  await createInboxEntry({
    body: buildDescription(data),
    subject: "Ontwerpdetails via website",
    channel: "website_ontwerpdetails",
    customerId: customer?.id,
    leadId: leadId ?? undefined,
  });

  return {
    formType: "ontwerpdetails" as const,
    linked: "pending" as const,
    leadId,
    orderNumber: data.orderNumber ?? null,
    message:
      "Ontwerpdetails opgeslagen. Geen order gevonden — taak aangemaakt voor koppeling.",
  };
}

export async function processFormSubmission(data: NormalizedFormData) {
  switch (data.formType) {
    case "contact":
      return processContactForm(data);
    case "ontwerpdetails":
      return processOntwerpdetailsForm(data);
    case "aanvraag":
    default:
      return processAanvraagForm(data);
  }
}
