import { NextResponse } from "next/server";
import { verifyWebhookRequest } from "@/lib/webhooks/auth";
import {
  normalizeFormPayload,
  parseRequestBody,
} from "@/lib/webhooks/parse-form-payload";
import { processFormSubmission } from "@/lib/webhooks/process-form-submission";

export async function POST(request: Request) {
  const authError = verifyWebhookRequest(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const body = await parseRequestBody(request);
    const data = normalizeFormPayload(body, url.searchParams.get("type"));

    const result = await processFormSubmission(data);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[webhook/forms]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Verwerking mislukt",
      },
      { status: 500 }
    );
  }
}
