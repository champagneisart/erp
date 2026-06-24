"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { customers, leads, orders, tasks } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";
import {
  canLeadTransition,
  type LeadStatus,
} from "@/lib/constants/statuses";
import { logActivity } from "@/lib/actions/log";
import { extractLeadData } from "@/lib/ai";

function nextOrderNumber(): string {
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-6);
  return `CIA-${year}-${seq}`;
}

export async function createLead(data: {
  customerId?: number;
  source: string;
  title?: string;
  description?: string;
  status?: LeadStatus;
}) {
  const session = await auth();
  assertStaff(session);

  const [row] = await db
    .insert(leads)
    .values({
      customerId: data.customerId ?? null,
      source: data.source as "manual",
      title: data.title ?? null,
      description: data.description ?? null,
      status: data.status ?? "new",
    })
    .returning();

  revalidatePath("/leads");
  return row;
}

export async function updateLeadStatus(id: number, status: LeadStatus) {
  const session = await auth();
  assertStaff(session);

  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) throw new Error("Aanvraag niet gevonden");
  if (!canLeadTransition(lead.status as LeadStatus, status)) {
    throw new Error("Ongeldige statusovergang");
  }

  await db
    .update(leads)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(leads.id, id));

  await logActivity({
    entityType: "lead",
    entityId: id,
    action: "status_change",
    fromValue: lead.status,
    toValue: status,
    userId: Number(session!.user!.id),
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function convertLeadToOrder(leadId: number) {
  const session = await auth();
  assertStaff(session);

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error("Aanvraag niet gevonden");
  if (!lead.customerId) throw new Error("Koppel eerst een klant aan de aanvraag");

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber: nextOrderNumber(),
      leadId: lead.id,
      customerId: lead.customerId,
      status: "awaiting_customer_info",
      theme: lead.title,
    })
    .returning();

  await db
    .update(leads)
    .set({ status: "converted", updatedAt: new Date().toISOString() })
    .where(eq(leads.id, leadId));

  await db.insert(tasks).values([
    {
      title: "Richtlijn / werkbon maken",
      orderId: order.id,
      priority: "high",
      isAutomatic: true,
    },
    {
      title: "Voorraad controleren en reserveren",
      orderId: order.id,
      priority: "medium",
      isAutomatic: true,
    },
  ]);

  await logActivity({
    entityType: "order",
    entityId: order.id,
    action: "created_from_lead",
    toValue: String(leadId),
    userId: Number(session!.user!.id),
  });

  revalidatePath("/orders");
  revalidatePath("/leads");
  return order;
}

export async function createLeadFromIntakeText(rawText: string) {
  const session = await auth();
  assertStaff(session);

  const parsed = await extractLeadData(rawText);

  let customerId: number | null = null;
  if (parsed.email) {
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, parsed.email))
      .limit(1);
    if (existing) customerId = existing.id;
  }

  if (!customerId) {
    const [createdCustomer] = await db
      .insert(customers)
      .values({
        name: parsed.name ?? "Nieuwe klant",
        company: parsed.company,
        email: parsed.email,
        phone: parsed.phone,
      })
      .returning();
    customerId = createdCustomer.id;
  }

  const [lead] = await db
    .insert(leads)
    .values({
      customerId,
      source: (parsed.source as "website" | "email" | "whatsapp" | "instagram" | "manual" | "chatbot") ?? "manual",
      title: parsed.title ?? "Nieuwe aanvraag",
      description: parsed.description ?? rawText,
      rawPayload: rawText,
      missingFields: JSON.stringify(parsed.missing_fields ?? []),
      status: "new",
    })
    .returning();

  revalidatePath("/leads");
  revalidatePath(`/leads/${lead.id}`);
  revalidatePath(`/customers/${customerId}`);

  return { leadId: lead.id, customerId, parsed };
}
