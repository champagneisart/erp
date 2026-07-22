"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  appSettings,
  orders,
  users,
  workInstructions,
  statusPageTokens,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";
import {
  canOrderTransition,
  type OrderStatus,
} from "@/lib/constants/statuses";
import { logActivity } from "@/lib/actions/log";
import { deductForOrder } from "@/lib/actions/inventory";

export async function updateOrder(
  id: number,
  data: Partial<{
    theme: string;
    bottleFormat: string;
    quantity: number;
    deadline: string;
    fulfillment: "pickup" | "ship";
    productId: number | null;
    artistUserId: number | null;
    expectedReadyDate: string;
    invoiceStatus: "not_sent" | "sent" | "paid" | "overdue";
    trackingNumber: string;
  }>
) {
  const session = await auth();
  assertStaff(session);

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) throw new Error("Order niet gevonden");

  const changes: string[] = [];
  const labels: Record<string, string> = {
    theme: "thema",
    bottleFormat: "formaat",
    quantity: "aantal",
    deadline: "deadline",
    fulfillment: "levering",
    productId: "fles",
    expectedReadyDate: "verwachte datum",
    invoiceStatus: "factuurstatus",
    trackingNumber: "track & trace",
  };

  for (const [key, label] of Object.entries(labels)) {
    const k = key as keyof typeof data;
    if (data[k] === undefined) continue;
    const from = String(order[k as keyof typeof order] ?? "—");
    const to = String(data[k] ?? "—");
    if (from !== to) changes.push(`${label}: ${from} → ${to}`);
  }

  await db
    .update(orders)
    .set({ ...data, updatedAt: new Date().toISOString() } as typeof orders.$inferInsert)
    .where(eq(orders.id, id));

  if (changes.length > 0) {
    await logActivity({
      entityType: "order",
      entityId: id,
      action: "updated",
      toValue: changes.join("; "),
      userId: Number(session!.user!.id),
    });
  }

  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
}

export async function updateOrderStatus(id: number, status: OrderStatus) {
  const session = await auth();
  assertStaff(session);

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) throw new Error("Order niet gevonden");
  if (!canOrderTransition(order.status as OrderStatus, status)) {
    throw new Error("Ongeldige statusovergang");
  }

  await db
    .update(orders)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(orders.id, id));

  if (status === "in_production" && order.productId && order.artistUserId && !order.stockDeductedAt) {
    const result = await deductForOrder(
      id,
      order.productId,
      order.quantity,
      order.artistUserId
    );
    if (result.success) {
      await db
        .update(orders)
        .set({
          stockDeductedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, id));
    }
  }

  await logActivity({
    entityType: "order",
    entityId: id,
    action: "status_change",
    fromValue: order.status,
    toValue: status,
    userId: Number(session!.user!.id),
  });

  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
  revalidatePath("/planning");
}

export async function assignArtist(orderId: number, artistUserId: number) {
  const session = await auth();
  assertStaff(session);

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order niet gevonden");

  const [artist] = await db
    .select()
    .from(users)
    .where(eq(users.id, artistUserId))
    .limit(1);

  await db
    .update(orders)
    .set({ artistUserId, updatedAt: new Date().toISOString() })
    .where(eq(orders.id, orderId));

  await logActivity({
    entityType: "order",
    entityId: orderId,
    action: "artist_assigned",
    fromValue: order.artistUserId ? String(order.artistUserId) : undefined,
    toValue: artist?.name ?? String(artistUserId),
    userId: Number(session!.user!.id),
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/planning");
}

export async function upsertWorkInstruction(
  orderId: number,
  data: {
    theme?: string;
    colorScheme?: string;
    textContent?: string;
    frontDesign?: string;
    backDesign?: string;
    style?: string;
    logosNotes?: string;
    visualElements?: string;
    attachmentsNotes?: string;
  }
) {
  const session = await auth();
  assertStaff(session);

  const existing = await db
    .select()
    .from(workInstructions)
    .where(eq(workInstructions.orderId, orderId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(workInstructions)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(workInstructions.orderId, orderId));
  } else {
    await db.insert(workInstructions).values({ orderId, ...data });
  }

  await logActivity({
    entityType: "order",
    entityId: orderId,
    action: "work_instruction_updated",
    userId: Number(session!.user!.id),
  });

  revalidatePath(`/orders/${orderId}`);
}

export async function generateStatusLink(orderId: number) {
  const session = await auth();
  assertStaff(session);

  const token = randomUUID();
  await db.insert(statusPageTokens).values({
    orderId,
    token,
  });

  await logActivity({
    entityType: "order",
    entityId: orderId,
    action: "status_link_created",
    toValue: token.slice(0, 8) + "…",
    userId: Number(session!.user!.id),
  });

  revalidatePath(`/orders/${orderId}`);
  return token;
}

export async function approveGuidelineOnOrder(orderId: number) {
  const session = await auth();
  assertStaff(session);

  await db
    .update(orders)
    .set({
      guidelineApprovedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, orderId));

  await logActivity({
    entityType: "order",
    entityId: orderId,
    action: "guideline_approved",
    userId: Number(session!.user!.id),
  });

  revalidatePath(`/orders/${orderId}`);
}

export async function pushWorkbonToExternalApp(orderId: number) {
  const session = await auth();
  assertStaff(session);

  const [integration] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "workbon_integration_url"))
    .limit(1);
  if (!integration?.value) {
    throw new Error("Geen werkbon integratie-URL ingesteld");
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order niet gevonden");
  const [workInstruction] = await db
    .select()
    .from(workInstructions)
    .where(eq(workInstructions.orderId, orderId))
    .limit(1);

  await fetch(integration.value, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order,
      workInstruction,
    }),
  });
}
