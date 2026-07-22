import { getAppBaseUrl } from "@/lib/auth/env";

export function getWebhookFormsUrl(): string {
  return `${getAppBaseUrl()}/api/webhooks/forms`;
}

/** URL voor Avada (secret in query — Avada kan geen custom headers) */
export function getWebhookFormsUrlForAvada(): string {
  const secret = process.env.WEBHOOK_SECRET?.trim();
  const base = getWebhookFormsUrl();
  if (!secret) return base;
  return `${base}?secret=${encodeURIComponent(secret)}`;
}

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.WEBHOOK_SECRET?.trim());
}
