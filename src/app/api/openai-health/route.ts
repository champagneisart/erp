import { NextResponse } from "next/server";
import { performOpenAiHealthCheck } from "@/lib/ai/health-check";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET ontbreekt" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await performOpenAiHealthCheck("cron");
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
