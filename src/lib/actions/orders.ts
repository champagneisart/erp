"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  appSettings,
  orders,
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
import { reserveInventoryForOrder, consumeInventoryForOrder } from "@/lib/actions/inventory";

export async function updateOrder(
  id: number,
  data: Partial<{
    theme: string;
    bottleFormat: string;
    quantity: number;
    deadline: string;
    fulfillment: "pickup" | "ship";
    artistUserId: number | null;
    expectedReadyDate: string;
    invoiceStatus: "not_sent" | "sent" | "paid" | "overdue";
    trackingNumber: string;
  }>
) {
  const session = await auth();
  assertStaff(session);

  await db
    .update(orders)
    .set({ ...data, updatedAt: new Date().toISOString() } as typeof orders.$inferInsert)
    .where(eq(orders.id, id));

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

  if (status === "input_complete" && order.productId) {
    await reserveInventoryForOrder(id, order.productId, order.quantity);
  }
  if (status === "completed" && order.productId) {
    await consumeInventoryForOrder(id, order.productId, order.quantity);
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

  await db
    .update(orders)
    .set({ artistUserId, updatedAt: new Date().toISOString() })
    .where(eq(orders.id, orderId));

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

  revalidatePath(`/orders/${orderId}`);
  return token;
}

export async function approveGuidelineOnOrder(orderId: number) {
  await db
    .update(orders)
    .set({
      guidelineApprovedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, orderId));
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
