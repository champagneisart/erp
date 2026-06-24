import { db } from "@/lib/db";
import { appSettings, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  runOpenAiHealthCheckAction,
  upsertSetting,
} from "@/lib/actions/ai-studio";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function SettingsPage() {
  const session = await auth();
  const allUsers = isAdmin(session) ? await db.select().from(users) : [];
  const [openAiSetting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "openai_api_key"))
    .limit(1);
  const [workbonUrl] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "workbon_integration_url"))
    .limit(1);
  const [healthStatus] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "openai_health_status"))
    .limit(1);
  const [healthCheckedAt] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "openai_health_checked_at"))
    .limit(1);
  const [healthMessage] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "openai_health_message"))
    .limit(1);
  const [healthLatency] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "openai_health_latency_ms"))
    .limit(1);
  const [healthTrigger] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "openai_health_trigger"))
    .limit(1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Instellingen</h1>
      <Card>
        <CardHeader>
          <CardTitle>Omgeving</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted space-y-2">
          <p>Zie docs/DEPLOYMENT.md voor Vercel, Neon en subdomeinen.</p>
          <p>
            Hosts: app / artist / status subdomeinen via middleware (
            {process.env.NEXT_PUBLIC_APP_HOST ?? "localhost"})
          </p>
        </CardContent>
      </Card>
      {isAdmin(session) && (
        <Card>
          <CardHeader>
            <CardTitle>OpenAI koppeling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted">
              Voeg een API key toe om AI-extractie en agentgedrag te activeren in leads/inbox.
            </p>
            <form
              action={async (fd) => {
                "use server";
                await upsertSetting(
                  "openai_api_key",
                  (fd.get("openai_api_key") as string) ?? ""
                );
              }}
              className="flex gap-2"
            >
              <Input
                name="openai_api_key"
                type="password"
                defaultValue={openAiSetting?.value ?? ""}
                placeholder="sk-..."
              />
              <Button type="submit">Opslaan</Button>
            </form>
          </CardContent>
        </Card>
      )}
      {isAdmin(session) && (
        <Card>
          <CardHeader>
            <CardTitle>OpenAI statusmonitor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted">
              Status:{" "}
              <span
                className={
                  healthStatus?.value === "active"
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-red-700"
                }
              >
                {healthStatus?.value === "active" ? "Actief" : "Niet actief"}
              </span>
            </p>
            <p className="text-muted">
              Laatste check: {healthCheckedAt?.value ?? "Nog niet uitgevoerd"}
            </p>
            <p className="text-muted">Melding: {healthMessage?.value ?? "—"}</p>
            <p className="text-muted">
              Bron: {healthTrigger?.value ?? "—"} | Latency:{" "}
              {healthLatency?.value ? `${healthLatency.value} ms` : "—"}
            </p>
            <form
              action={async () => {
                "use server";
                await runOpenAiHealthCheckAction();
              }}
            >
              <Button type="submit" variant="outline">
                Test OpenAI koppeling nu
              </Button>
            </form>
            <p className="text-xs text-muted">
              Voor automatische checks: maak een cronjob naar{" "}
              <code>/api/openai-health</code> met <code>CRON_SECRET</code>.
            </p>
          </CardContent>
        </Card>
      )}
      {isAdmin(session) && (
        <Card>
          <CardHeader>
            <CardTitle>Werkbon-app integratie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted">
              Vul URL in van je bestaande werkbon-app (webhook/API endpoint) om later automatisch werkbonnen door te sturen.
            </p>
            <form
              action={async (fd) => {
                "use server";
                await upsertSetting(
                  "workbon_integration_url",
                  (fd.get("workbon_integration_url") as string) ?? ""
                );
              }}
              className="flex gap-2"
            >
              <Input
                name="workbon_integration_url"
                defaultValue={workbonUrl?.value ?? ""}
                placeholder="https://jouw-werkbon-app/api/import"
              />
              <Button type="submit" variant="outline">
                Opslaan
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {isAdmin(session) && (
        <Card>
          <CardHeader>
            <CardTitle>Gebruikers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {allUsers.map((u) => (
                <li key={u.id}>
                  {u.name} — {u.email} ({u.role})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
