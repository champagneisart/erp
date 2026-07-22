"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { getWebhookCaptures } from "@/lib/webhooks/capture";
import { resolveAvadaFormTypeDetailed } from "@/lib/webhooks/avada-forms";
import { normalizeFormPayload } from "@/lib/webhooks/parse-form-payload";
import { processFormSubmission } from "@/lib/webhooks/process-form-submission";

export type ProcessCapturesResult = {
  processed: number;
  ignored: number;
  skipped: number;
  errors: string[];
};

export async function processStoredWebhookCaptures(): Promise<ProcessCapturesResult> {
  const session = await auth();
  if (!isAdmin(session)) throw new Error("Geen toegang");

  const captures = await getWebhookCaptures();
  const result: ProcessCapturesResult = {
    processed: 0,
    ignored: 0,
    skipped: 0,
    errors: [],
  };

  for (const capture of [...captures].reverse()) {
    if (capture.flat.source === "admin_test" || capture.flat.form_id === "plugin_test") {
      result.skipped++;
      continue;
    }

    try {
      const data = normalizeFormPayload(capture.body);
      data.formId = data.formId ?? capture.flat.form_id;
      data.formName = data.formName ?? capture.flat.form_name;

      const detection = resolveAvadaFormTypeDetailed(data.formId, data.formName, capture.flat);
      if (detection.type === "ignore") {
        result.ignored++;
        continue;
      }
      if (detection.type) data.formType = detection.type;

      await processFormSubmission(data);
      result.processed++;
    } catch (error) {
      result.errors.push(
        `${capture.flat.form_id ?? capture.id}: ${error instanceof Error ? error.message : "fout"}`
      );
    }
  }

  revalidatePath("/leads");
  revalidatePath("/inbox");
  revalidatePath("/tasks");
  revalidatePath("/settings");

  return result;
}
