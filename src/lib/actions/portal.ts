"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  customers,
  orders,
  statusPageTokens,
  workInstructions,
} from "@/db/schema";
import { getPublicStatusLabel } from "@/lib/constants/statuses";
import { approveGuidelineOnOrder } from "@/lib/actions/orders";

export async function getPortalOrderByToken(token: string) {
  const [link] = await db
    .select()
    .from(statusPageTokens)
    .where(eq(statusPageTokens.token, token))
    .limit(1);

  if (!link) return null;

  await db
    .update(statusPageTokens)
    .set({ viewCount: link.viewCount + 1 })
    .where(eq(statusPageTokens.id, link.id));

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, link.orderId))
    .limit(1);

  if (!order) return null;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, order.customerId))
    .limit(1);

  const [wi] = await db
    .select()
    .from(workInstructions)
    .where(eq(workInstructions.orderId, order.id))
    .limit(1);

  return {
    order,
    customer,
    workInstruction: wi ?? null,
    publicStatus: getPublicStatusLabel(order.status),
    token,
  };
}

export async function portalApproveGuideline(token: string) {
  const data = await getPortalOrderByToken(token);
  if (!data) throw new Error("Ongeldige link");
  await approveGuidelineOnOrder(data.order.id);
}
