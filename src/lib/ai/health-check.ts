import { eq } from "drizzle-orm";
import { appSettings } from "@/db/schema";
import { db } from "@/lib/db";

type HealthTrigger = "manual" | "cron" | "system";

export type OpenAiHealthCheckResult = {
  ok: boolean;
  checkedAt: string;
  status: "active" | "inactive";
  message: string;
  latencyMs?: number;
  trigger: HealthTrigger;
};

async function getOpenAiApiKey(): Promise<string | null> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;

  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "openai_api_key"))
    .limit(1);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string) {
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date().toISOString() },
    });
}

async function persistHealth(result: OpenAiHealthCheckResult) {
  await Promise.all([
    setSetting("openai_health_status", result.status),
    setSetting("openai_health_checked_at", result.checkedAt),
    setSetting("openai_health_message", result.message),
    setSetting("openai_health_trigger", result.trigger),
    setSetting(
      "openai_health_latency_ms",
      typeof result.latencyMs === "number" ? String(result.latencyMs) : ""
    ),
  ]);
}

export async function performOpenAiHealthCheck(
  trigger: HealthTrigger
): Promise<OpenAiHealthCheckResult> {
  const checkedAt = new Date().toISOString();
  const apiKey = await getOpenAiApiKey();

  if (!apiKey) {
    const result: OpenAiHealthCheckResult = {
      ok: false,
      checkedAt,
      status: "inactive",
      message: "Geen OpenAI API-key gevonden in instellingen of omgeving.",
      trigger,
    };
    await persistHealth(result);
    return result;
  }

  const startedAt = Date.now();
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 5,
        messages: [{ role: "user", content: "reply with OK" }],
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      const result: OpenAiHealthCheckResult = {
        ok: false,
        checkedAt,
        status: "inactive",
        message: `OpenAI fout (${response.status}): ${raw.slice(0, 160)}`,
        latencyMs: Date.now() - startedAt,
        trigger,
      };
      await persistHealth(result);
      return result;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const ok = typeof content === "string" && content.trim().length > 0;

    const result: OpenAiHealthCheckResult = {
      ok,
      checkedAt,
      status: ok ? "active" : "inactive",
      message: ok
        ? "OpenAI koppeling actief en antwoord ontvangen."
        : "OpenAI reageerde zonder bruikbare output.",
      latencyMs: Date.now() - startedAt,
      trigger,
    };
    await persistHealth(result);
    return result;
  } catch (error) {
    const result: OpenAiHealthCheckResult = {
      ok: false,
      checkedAt,
      status: "inactive",
      message:
        error instanceof Error
          ? `Netwerkfout: ${error.message}`
          : "Onbekende fout bij OpenAI healthcheck.",
      latencyMs: Date.now() - startedAt,
      trigger,
    };
    await persistHealth(result);
    return result;
  }
}
