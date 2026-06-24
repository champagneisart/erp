"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { customers, customerFiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/actions/log";

export async function createCustomer(data: {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  notes?: string;
}) {
  const session = await auth();
  assertStaff(session);

  const [row] = await db
    .insert(customers)
    .values({
      name: data.name,
      company: data.company ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      billingAddress: data.billingAddress ?? null,
      shippingAddress: data.shippingAddress ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  await logActivity({
    entityType: "customer",
    entityId: row.id,
    action: "created",
    userId: Number(session!.user!.id),
  });

  revalidatePath("/customers");
  return row;
}

export async function updateCustomer(
  id: number,
  data: Partial<{
    name: string;
    company: string;
    email: string;
    phone: string;
    billingAddress: string;
    shippingAddress: string;
    notes: string;
  }>
) {
  const session = await auth();
  assertStaff(session);

  await db
    .update(customers)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(customers.id, id));

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function addCustomerFile(
  customerId: number,
  fileName: string,
  blobUrl: string,
  mimeType?: string
) {
  const session = await auth();
  assertStaff(session);

  await db.insert(customerFiles).values({
    customerId,
    fileName,
    blobUrl,
    mimeType: mimeType ?? null,
  });

  revalidatePath(`/customers/${customerId}`);
}
