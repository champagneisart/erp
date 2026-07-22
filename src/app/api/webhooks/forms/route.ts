import { NextResponse } from "next/server";
import { AVADA_FORM_CATALOG, resolveAvadaFormType } from "@/lib/webhooks/avada-forms";
import { verifyWebhookRequest } from "@/lib/webhooks/auth";
import {
  appendWebhookCapture,
  isWebhookProcessingEnabled,
} from "@/lib/webhooks/capture";
import { isWebhookConfigured } from "@/lib/webhooks/config";
import {
  normalizeFormPayload,
  parseRequestBody,
} from "@/lib/webhooks/parse-form-payload";
import { processFormSubmission } from "@/lib/webhooks/process-form-submission";

function flattenForCapture(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flattenForCapture(value as Record<string, unknown>));
      continue;
    }
    out[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return out;
}

export async function GET(request: Request) {
  const authError = verifyWebhookRequest(request);
  if (authError) {
    return NextResponse.json(
      {
        ok: false,
        endpoint: "forms",
        configured: isWebhookConfigured(),
        processing: isWebhookProcessingEnabled(),
        hint: "Gebruik ?secret=<WEBHOOK_SECRET> in de URL (Avada) of Authorization: Bearer",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    endpoint: "forms",
    processing: isWebhookProcessingEnabled(),
    catalog: AVADA_FORM_CATALOG,
  });
}

export async function POST(request: Request) {
  const authError = verifyWebhookRequest(request);
  if (authError) return authError;

  const contentType = request.headers.get("content-type") ?? "unknown";

  try {
    const url = new URL(request.url);
    const body = await parseRequestBody(request);
    const flat = flattenForCapture(body);

    const capture = await appendWebhookCapture({ contentType, body, flat });

    console.info("[webhook/forms] capture", {
      id: capture.id,
      contentType,
      keys: Object.keys(flat),
    });

    if (!isWebhookProcessingEnabled()) {
      return NextResponse.json({
        ok: true,
        mode: "capture",
        captureId: capture.id,
        receivedAt: capture.receivedAt,
        fields: flat,
        hint: "Payload opgeslagen. Zet WEBHOOK_PROCESS=true om leads/orders aan te maken.",
      });
    }

    const data = normalizeFormPayload(body, url.searchParams.get("type"));

    if (body.form_id !== undefined && !data.formId) {
      data.formId = String(body.form_id);
    }
    if (typeof body.form_name === "string" && !data.formName) {
      data.formName = body.form_name;
    }

    const resolved = resolveAvadaFormType(data.formId, data.formName);
    if (resolved === "ignore") {
      return NextResponse.json({
        ok: true,
        mode: "process",
        ignored: true,
        captureId: capture.id,
        formId: data.formId,
        formName: data.formName,
      });
    }
    if (resolved) data.formType = resolved;

    const result = await processFormSubmission(data);

    return NextResponse.json({
      ok: true,
      mode: "process",
      captureId: capture.id,
      formId: data.formId,
      formName: data.formName,
      ...result,
    });
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
