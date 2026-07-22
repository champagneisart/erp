import { NextResponse } from "next/server";

export function verifyWebhookRequest(request: Request): NextResponse | null {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "WEBHOOK_SECRET is niet geconfigureerd" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-webhook-secret");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") ?? url.searchParams.get("key") ?? "";

  const provided =
    authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : headerSecret ?? querySecret;

  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
