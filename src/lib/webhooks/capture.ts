import { db } from "@/lib/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const CAPTURE_KEY = "webhook_form_captures";
const MAX_CAPTURES = 25;

export type WebhookCapture = {
  id: string;
  receivedAt: string;
  contentType: string;
  body: Record<string, unknown>;
  flat: Record<string, string>;
};

function parseCaptures(raw: string | null | undefined): WebhookCapture[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WebhookCapture[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getWebhookCaptures(): Promise<WebhookCapture[]> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, CAPTURE_KEY))
    .limit(1);
  return parseCaptures(row?.value);
}

export async function appendWebhookCapture(input: {
  contentType: string;
  body: Record<string, unknown>;
  flat: Record<string, string>;
}): Promise<WebhookCapture> {
  const existing = await getWebhookCaptures();
  const capture: WebhookCapture = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    contentType: input.contentType,
    body: input.body,
    flat: input.flat,
  };

  const next = [capture, ...existing].slice(0, MAX_CAPTURES);
  const value = JSON.stringify(next);

  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, CAPTURE_KEY))
    .limit(1);

  if (row) {
    await db
      .update(appSettings)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(appSettings.key, CAPTURE_KEY));
  } else {
    await db.insert(appSettings).values({
      key: CAPTURE_KEY,
      value,
    });
  }

  return capture;
}

/** Standaard aan — alleen capture-only met WEBHOOK_CAPTURE=true */
export function isWebhookProcessingEnabled(): boolean {
  if (process.env.WEBHOOK_CAPTURE === "true") return false;
  if (process.env.WEBHOOK_PROCESS === "false") return false;
  return true;
}
