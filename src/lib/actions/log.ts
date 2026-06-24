import { db } from "@/lib/db";
import { activityLog } from "@/db/schema";

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
