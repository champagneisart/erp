"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { tasks } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";

export async function createTask(data: {
  title: string;
  description?: string;
  assigneeUserId?: number;
  orderId?: number;
  leadId?: number;
  priority?: "low" | "medium" | "high";
  dueAt?: string;
}) {
  const session = await auth();
  assertStaff(session);

  const [row] = await db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description ?? null,
      assigneeUserId: data.assigneeUserId ?? null,
      orderId: data.orderId ?? null,
      leadId: data.leadId ?? null,
      priority: data.priority ?? "medium",
      dueAt: data.dueAt ?? null,
    })
    .returning();

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return row;
}

export async function updateTaskStatus(
  id: number,
  status: "open" | "done" | "cancelled"
) {
  const session = await auth();
  assertStaff(session);

  await db.update(tasks).set({ status }).where(eq(tasks.id, id));
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
