import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLog, users } from "@/db/schema";

export async function logActivity(params: {
  entityType: string;
  entityId: number;
  action: string;
  fromValue?: string;
  toValue?: string;
  userId?: number;
}) {
  await db.insert(activityLog).values({
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    fromValue: params.fromValue ?? null,
    toValue: params.toValue ?? null,
    userId: params.userId ?? null,
  });
}

export async function getOrderActivityLogs(orderId: number) {
  const rows = await db
    .select({ log: activityLog, user: users })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .where(
      and(eq(activityLog.entityType, "order"), eq(activityLog.entityId, orderId))
    )
    .orderBy(desc(activityLog.createdAt));

  return rows.map(({ log, user }) => ({
    ...log,
    userName: user?.name ?? null,
  }));
}
