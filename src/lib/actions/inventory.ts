"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import {
  inventory,
  inventoryLocations,
  inventoryMovements,
  products,
  supplierOrders,
  tasks,
  users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";
import type { ShipmentStatus } from "@/lib/constants/inventory";
import {
  getCachedLocations,
  getCachedProducts,
} from "@/lib/cache/inventory";

async function getStockRow(productId: number, locationId: number) {
  const [row] = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.productId, productId),
        eq(inventory.locationId, locationId)
      )
    )
    .limit(1);
  return row;
}

async function ensureStockRow(productId: number, locationId: number) {
  const existing = await getStockRow(productId, locationId);
  if (existing) return existing;
  const [row] = await db
    .insert(inventory)
    .values({ productId, locationId, quantity: 0, reserved: 0, minimum: 0 })
    .returning();
  return row;
}

async function recordMovement(data: {
  productId: number;
  quantity: number;
  movementType: "add" | "receive" | "transfer" | "consume" | "adjust";
  locationId?: number;
  locationFromId?: number;
  locationToId?: number;
  orderId?: number;
  supplierOrderId?: number;
  note?: string;
  userId?: number;
}) {
  await db.insert(inventoryMovements).values({
    productId: data.productId,
    locationId: data.locationId ?? null,
    locationFromId: data.locationFromId ?? null,
    locationToId: data.locationToId ?? null,
    orderId: data.orderId ?? null,
    supplierOrderId: data.supplierOrderId ?? null,
    movementType: data.movementType,
    quantity: data.quantity,
    note: data.note ?? null,
    userId: data.userId ?? null,
  });
}

export async function getAllLocations() {
  return db
    .select()
    .from(inventoryLocations)
    .orderBy(inventoryLocations.locationType, inventoryLocations.name);
}

export async function getLocationBySlug(slug: string) {
  const locations = await getCachedLocations();
  return locations.find((l) => l.slug === slug) ?? null;
}

export async function getOfficeLocation() {
  const [loc] = await db
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.slug, "office"))
    .limit(1);
  if (!loc) throw new Error("Kantoorlocatie ontbreekt. Draai npm run db:migrate-locations");
  return loc;
}

export async function getArtistLocation(artistUserId: number) {
  const [loc] = await db
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.artistUserId, artistUserId))
    .limit(1);
  if (!loc) throw new Error("Geen voorraadlocatie voor deze kunstenaar");
  return loc;
}

export async function getAllProducts() {
  return getCachedProducts();
}

/** Alle inventory-pagedata in één parallelle batch (sneller dan losse awaits) */
export async function getInventoryPageData() {
  const [products, rows, shipments, locations] = await Promise.all([
    getCachedProducts(),
    getInventoryOverview(),
    getIncomingShipments(),
    getCachedLocations(),
  ]);
  return { products, rows, shipments, locations };
}

export async function createProduct(data: {
  name: string;
  brand?: string;
  format?: string;
  sku?: string;
  type: string;
  purchasePriceExVat?: string;
  sellPriceExVat?: string;
  sellPriceIncVat?: string;
}) {
  const session = await auth();
  assertStaff(session);

  const office = await getOfficeLocation();
  const [artistLoc] = await db
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.locationType, "artist"))
    .limit(1);

  const [product] = await db
    .insert(products)
    .values({
      name: data.name,
      brand: data.brand ?? null,
      format: data.format ?? null,
      sku: data.sku ?? null,
      type: data.type as "standard_bottle",
      purchasePriceExVat: data.purchasePriceExVat ?? null,
      sellPriceExVat: data.sellPriceExVat ?? null,
      sellPriceIncVat: data.sellPriceIncVat ?? null,
    })
    .returning();

  await db.insert(inventory).values({
    productId: product.id,
    locationId: office.id,
    quantity: 0,
  });
  if (artistLoc) {
    await db.insert(inventory).values({
      productId: product.id,
      locationId: artistLoc.id,
      quantity: 0,
    });
  }

  revalidatePath("/inventory");
  revalidateTag("inventory-products", "max");
  return product;
}

export async function updateProduct(
  id: number,
  data: Partial<{
    name: string;
    brand: string;
    format: string;
    purchasePriceExVat: string;
    sellPriceExVat: string;
    sellPriceIncVat: string;
  }>
) {
  const session = await auth();
  assertStaff(session);

  await db.update(products).set(data).where(eq(products.id, id));
  revalidatePath("/inventory");
}

/** Flessen bijboeken op kantoor of bij kunstenaar */
export async function addBottles(data: {
  productId: number;
  locationId: number;
  quantity: number;
  note?: string;
}) {
  const session = await auth();
  assertStaff(session);
  if (data.quantity <= 0) throw new Error("Aantal moet groter dan 0 zijn");

  const userId = Number(session!.user!.id);
  const row = await ensureStockRow(data.productId, data.locationId);
  await db
    .update(inventory)
    .set({
      quantity: row.quantity + data.quantity,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(inventory.productId, data.productId),
        eq(inventory.locationId, data.locationId)
      )
    );

  await recordMovement({
    productId: data.productId,
    locationId: data.locationId,
    movementType: "add",
    quantity: data.quantity,
    note: data.note ?? "Handmatig bijgeboekt",
    userId,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/log/${await locationSlug(data.locationId)}`);
}

/** Verplaats voorraad van kantoor naar kunstenaar (of andere locatie) */
export async function transferStock(data: {
  productId: number;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
  note?: string;
}) {
  const session = await auth();
  assertStaff(session);
  if (data.quantity <= 0) throw new Error("Aantal moet groter dan 0 zijn");
  if (data.fromLocationId === data.toLocationId) {
    throw new Error("Bron en bestemming moeten verschillen");
  }

  const userId = Number(session!.user!.id);
  const from = await getStockRow(data.productId, data.fromLocationId);
  if (!from || from.quantity < data.quantity) {
    throw new Error("Onvoldoende voorraad op bronlocatie");
  }

  await ensureStockRow(data.productId, data.toLocationId);
  const to = await getStockRow(data.productId, data.toLocationId);

  await db
    .update(inventory)
    .set({
      quantity: from.quantity - data.quantity,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(inventory.productId, data.productId),
        eq(inventory.locationId, data.fromLocationId)
      )
    );

  await db
    .update(inventory)
    .set({
      quantity: (to?.quantity ?? 0) + data.quantity,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(inventory.productId, data.productId),
        eq(inventory.locationId, data.toLocationId)
      )
    );

  const [fromLoc] = await db
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.id, data.fromLocationId))
    .limit(1);
  const [toLoc] = await db
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.id, data.toLocationId))
    .limit(1);

  await recordMovement({
    productId: data.productId,
    locationFromId: data.fromLocationId,
    locationToId: data.toLocationId,
    locationId: data.toLocationId,
    movementType: "transfer",
    quantity: data.quantity,
    note:
      data.note ??
      `Van ${fromLoc?.name ?? "bron"} naar ${toLoc?.name ?? "bestemming"}`,
    userId,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/log/${fromLoc?.slug ?? ""}`);
  revalidatePath(`/inventory/log/${toLoc?.slug ?? ""}`);
}

async function locationSlug(locationId: number) {
  const [loc] = await db
    .select()
    .from(inventoryLocations)
    .where(eq(inventoryLocations.id, locationId))
    .limit(1);
  return loc?.slug ?? "office";
}

/** Online bestelling registreren — onderweg naar kantoor of kunstenaar */
export async function registerIncomingShipment(data: {
  productId: number;
  quantity: number;
  destinationLocationId: number;
  supplierName?: string;
  orderReference?: string;
  trackingNumber?: string;
  notes?: string;
}) {
  const session = await auth();
  assertStaff(session);

  const [order] = await db
    .insert(supplierOrders)
    .values({
      productId: data.productId,
      quantityOrdered: data.quantity,
      destinationLocationId: data.destinationLocationId,
      supplierName: data.supplierName ?? null,
      orderReference: data.orderReference ?? null,
      trackingNumber: data.trackingNumber ?? null,
      notes: data.notes ?? null,
      status: "in_transit",
    })
    .returning();

  revalidatePath("/inventory");
  return order;
}

/** Zending ontvangen → voorraad bijboeken */
export async function markShipmentReceived(id: number) {
  const session = await auth();
  assertStaff(session);

  const [shipment] = await db
    .select()
    .from(supplierOrders)
    .where(eq(supplierOrders.id, id))
    .limit(1);
  if (!shipment) throw new Error("Zending niet gevonden");
  if (shipment.status === "received") return;

  const toReceive = shipment.quantityOrdered - shipment.quantityReceived;
  if (toReceive > 0) {
    const userId = Number(session!.user!.id);
    const row = await ensureStockRow(
      shipment.productId,
      shipment.destinationLocationId
    );
    await db
      .update(inventory)
      .set({
        quantity: row.quantity + toReceive,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(inventory.productId, shipment.productId),
          eq(inventory.locationId, shipment.destinationLocationId)
        )
      );

    await recordMovement({
      productId: shipment.productId,
      locationId: shipment.destinationLocationId,
      supplierOrderId: id,
      movementType: "receive",
      quantity: toReceive,
      note: `Levering ontvangen (bestelling #${id})`,
      userId,
    });
  }

  await db
    .update(supplierOrders)
    .set({
      status: "received",
      quantityReceived: shipment.quantityOrdered,
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(supplierOrders.id, id));

  revalidatePath("/inventory");
}

export async function getStockForProduct(productId: number, locationId: number) {
  const row = await getStockRow(productId, locationId);
  return row?.quantity ?? 0;
}

export type StockCheckResult = {
  ok: boolean;
  available: number;
  needed: number;
  locationName: string;
};

export async function checkArtistStock(
  productId: number,
  artistUserId: number,
  quantity: number
): Promise<StockCheckResult> {
  const location = await getArtistLocation(artistUserId);
  const available = await getStockForProduct(productId, location.id);
  return {
    ok: available >= quantity,
    available,
    needed: quantity,
    locationName: location.name,
  };
}

/** Bij in_productie: afboeken bij kunstenaar; bij tekort → taak aanmaken */
export async function deductForOrder(
  orderId: number,
  productId: number,
  quantity: number,
  artistUserId: number
): Promise<{ success: boolean; message?: string }> {
  const location = await getArtistLocation(artistUserId);
  const row = await getStockRow(productId, location.id);
  const available = row ? row.quantity - row.reserved : 0;

  if (available < quantity) {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    await db.insert(tasks).values({
      title: `Voorraadtekort: ${product?.name ?? "fles"}`,
      description: `Order #${orderId}: ${quantity} nodig, ${available} beschikbaar bij kunstenaar.`,
      orderId,
      status: "open",
      priority: "high",
      isAutomatic: true,
    });

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return {
      success: false,
      message: `Onvoldoende voorraad bij kunstenaar (${available} vrij, ${quantity} nodig)`,
    };
  }

  await db
    .update(inventory)
    .set({
      quantity: row!.quantity - quantity,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(inventory.productId, productId),
        eq(inventory.locationId, location.id)
      )
    );

  await recordMovement({
    productId,
    locationId: location.id,
    orderId,
    movementType: "consume",
    quantity,
    note: `Afgeboekt voor order #${orderId}`,
  });

  revalidatePath("/inventory");
  return { success: true };
}

export async function getLowStockProducts() {
  return db
    .select({
      product: products,
      inv: inventory,
      location: inventoryLocations,
    })
    .from(inventory)
    .innerJoin(products, eq(products.id, inventory.productId))
    .innerJoin(inventoryLocations, eq(inventoryLocations.id, inventory.locationId))
    .where(
      sql`${inventory.quantity} <= ${inventory.minimum} AND ${inventory.minimum} > 0`
    );
}

export async function getInventoryOverview() {
  return db
    .select({
      product: products,
      inv: inventory,
      location: inventoryLocations,
    })
    .from(inventory)
    .innerJoin(products, eq(products.id, inventory.productId))
    .innerJoin(inventoryLocations, eq(inventoryLocations.id, inventory.locationId))
    .orderBy(inventoryLocations.name, products.name);
}

export async function getIncomingShipments() {
  return db
    .select({
      shipment: supplierOrders,
      product: products,
      location: inventoryLocations,
    })
    .from(supplierOrders)
    .innerJoin(products, eq(products.id, supplierOrders.productId))
    .innerJoin(
      inventoryLocations,
      eq(inventoryLocations.id, supplierOrders.destinationLocationId)
    )
    .where(sql`${supplierOrders.status} = 'in_transit'`)
    .orderBy(sql`${supplierOrders.createdAt} DESC`);
}

export async function updateShipmentStatus(id: number, status: ShipmentStatus) {
  if (status === "received") {
    await markShipmentReceived(id);
    return;
  }
  const session = await auth();
  assertStaff(session);
  await db
    .update(supplierOrders)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(supplierOrders.id, id));
  revalidatePath("/inventory");
}

/** Logboek voor één locatie (kantoor of kunstenaar) */
export async function getLocationLogbook(locationId: number, limit = 50) {
  const rows = await db
    .select({
      movement: inventoryMovements,
      product: products,
      user: users,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(products.id, inventoryMovements.productId))
    .leftJoin(users, eq(users.id, inventoryMovements.userId))
    .where(
      sql`${inventoryMovements.locationId} = ${locationId}
        OR ${inventoryMovements.locationFromId} = ${locationId}
        OR ${inventoryMovements.locationToId} = ${locationId}`
    )
    .orderBy(sql`${inventoryMovements.createdAt} DESC`)
    .limit(limit);

  const locMap = new Map(
    (await getCachedLocations()).map((l) => [l.id, l.name])
  );

  return rows.map((row) => ({
    ...row,
    fromName: row.movement.locationFromId
      ? locMap.get(row.movement.locationFromId)
      : null,
    toName: row.movement.locationToId
      ? locMap.get(row.movement.locationToId)
      : null,
  }));
}
