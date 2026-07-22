import { NextResponse } from "next/server";
import { resolveAvadaFormType } from "@/lib/webhooks/avada-forms";
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

    const formId =
      data.formId ??
      (typeof body.form_id === "string" ? body.form_id : undefined) ??
      (typeof body.fusion_form_id === "string" ? body.fusion_form_id : undefined);
    const formName =
      data.formName ??
      (typeof body.form_name === "string" ? body.form_name : undefined);

    if (formId) data.formId = formId;
    if (formName) data.formName = formName;

    const resolved = resolveAvadaFormType(data.formId, data.formName);
    if (resolved === "ignore") {
      return NextResponse.json({
        ok: true,
        ignored: true,
        formId: data.formId,
        formName: data.formName,
      });
    }
    if (resolved) data.formType = resolved;

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
