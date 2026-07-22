"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { artistOrderEvents, orders, products, workInstructions } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function addArtistEvent(
  orderId: number,
  eventType: "viewed" | "started" | "ready_for_review" | "question" | "photo_upload",
  note?: string,
  blobUrl?: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Niet ingelogd");

  const userId = Number(session.user.id);
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order niet gevonden");

  const role = session.user.role;
  if (role === "artist" && order.artistUserId !== userId) {
    throw new Error("Geen toegang tot deze order");
  }

  await db.insert(artistOrderEvents).values({
    orderId,
    userId,
    eventType,
    note: note ?? null,
    blobUrl: blobUrl ?? null,
  });

  revalidatePath("/artist");
  revalidatePath(`/orders/${orderId}`);
}

export async function getArtistOrders(userId: number) {
  return db
    .select({
      order: orders,
      product: products,
      workInstruction: workInstructions,
    })
    .from(orders)
    .leftJoin(products, eq(products.id, orders.productId))
    .leftJoin(workInstructions, eq(workInstructions.orderId, orders.id))
    .where(eq(orders.artistUserId, userId))
    .orderBy(asc(orders.deadline));
}
