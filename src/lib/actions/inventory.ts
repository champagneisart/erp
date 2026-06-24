"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { inventory, inventoryMovements, products } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";

export async function createProduct(data: {
  name: string;
  sku?: string;
  type: string;
  quantity?: number;
  minimum?: number;
}) {
  const session = await auth();
  assertStaff(session);

  const [product] = await db
    .insert(products)
    .values({
      name: data.name,
      sku: data.sku ?? null,
      type: data.type as "standard_bottle",
    })
    .returning();

  await db.insert(inventory).values({
    productId: product.id,
    quantity: data.quantity ?? 0,
    minimum: data.minimum ?? 0,
  });

  revalidatePath("/inventory");
  return product;
}

export async function adjustInventory(
  productId: number,
  quantity: number,
  note?: string
) {
  const session = await auth();
  assertStaff(session);

  await db
    .update(inventory)
    .set({ quantity, updatedAt: new Date().toISOString() })
    .where(eq(inventory.productId, productId));

  await db.insert(inventoryMovements).values({
    productId,
    movementType: "adjust",
    quantity,
    note: note ?? null,
  });

  revalidatePath("/inventory");
}

export async function reserveInventoryForOrder(
  orderId: number,
  productId: number,
  qty: number
) {
  const [inv] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.productId, productId))
    .limit(1);
  if (!inv) return;
  if (inv.quantity - inv.reserved < qty) {
    throw new Error("Onvoldoende vrije voorraad");
  }

  await db
    .update(inventory)
    .set({
      reserved: inv.reserved + qty,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(inventory.productId, productId));

  await db.insert(inventoryMovements).values({
    productId,
    orderId,
    movementType: "reserve",
    quantity: qty,
  });

  revalidatePath("/inventory");
}

export async function consumeInventoryForOrder(
  orderId: number,
  productId: number,
  qty: number
) {
  const [inv] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.productId, productId))
    .limit(1);
  if (!inv) return;

  await db
    .update(inventory)
    .set({
      quantity: Math.max(0, inv.quantity - qty),
      reserved: Math.max(0, inv.reserved - qty),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(inventory.productId, productId));

  await db.insert(inventoryMovements).values({
    productId,
    orderId,
    movementType: "consume",
    quantity: qty,
  });

  revalidatePath("/inventory");
}

export async function getLowStockProducts() {
  const rows = await db
    .select({
      product: products,
      inv: inventory,
    })
    .from(inventory)
    .innerJoin(products, eq(products.id, inventory.productId))
    .where(sql`${inventory.quantity} - ${inventory.reserved} <= ${inventory.minimum}`);

  return rows;
}
