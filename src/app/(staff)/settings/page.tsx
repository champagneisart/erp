import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/permissions";
import {
  createUser,
  getAllUsers,
  getCurrentUser,
  updateUser,
} from "@/lib/actions/users";
import {
  runOpenAiHealthCheckAction,
  upsertSetting,
} from "@/lib/actions/ai-studio";
import { db } from "@/lib/db";
import { appSettings } from "@/db/schema";
import { isMailjetConfigured } from "@/lib/email/mailjet";
import {
  getWebhookFormsUrlForAvada,
  isWebhookConfigured,
} from "@/lib/webhooks/config";
import { getWebhookCaptures, isWebhookProcessingEnabled } from "@/lib/webhooks/capture";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const session = await auth();
  const currentUser = await getCurrentUser();
  const allUsers = isAdmin(session) ? await getAllUsers() : [];

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

  const mailjetReady = isMailjetConfigured();
  const webhookReady = isWebhookConfigured();
  const avadaWebhookUrl = getWebhookFormsUrlForAvada();
  const webhookCaptures = isAdmin(session) ? await getWebhookCaptures() : [];
  const webhookProcessing = isWebhookProcessingEnabled();

  return (
    <div className="page-content space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Instellingen</h1>

      {currentUser && (
        <Card>
          <CardHeader>
            <CardTitle>Mijn account</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted space-y-2">
            <p>
              {currentUser.name} — {currentUser.email} ({currentUser.role})
            </p>
            <a href="/account" className="text-gold-bright hover:underline">
              Profiel & wachtwoord wijzigen →
            </a>
          </CardContent>
        </Card>
      )}

      {isAdmin(session) && (
        <Card>
          <CardHeader>
            <CardTitle>Gebruikersbeheer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              action={async (fd) => {
                "use server";
                await createUser({
                  name: fd.get("name") as string,
                  email: fd.get("email") as string,
                  password: fd.get("password") as string,
                  role: fd.get("role") as "admin" | "staff" | "artist",
                });
              }}
              className="form-stack rounded-lg border border-border p-4 sm:max-w-lg"
            >
              <p className="text-sm font-medium">Nieuwe gebruiker</p>
              <Input name="name" placeholder="Naam" required />
              <Input name="email" type="email" placeholder="E-mail" required />
              <Input
                name="password"
                type="password"
                minLength={8}
                placeholder="Tijdelijk wachtwoord"
                required
              />
              <Select name="role" required>
                <option value="staff">Staff</option>
                <option value="artist">Kunstenaar</option>
                <option value="admin">Admin</option>
              </Select>
              <Button type="submit">Gebruiker aanmaken</Button>
            </form>

            <div className="space-y-4">
              {allUsers.map((u) => (
                <form
                  key={u.id}
                  action={async (fd) => {
                    "use server";
                    await updateUser(u.id, {
                      name: fd.get("name") as string,
                      email: fd.get("email") as string,
                      role: fd.get("role") as "admin" | "staff" | "artist",
                      password: (fd.get("password") as string) || undefined,
                    });
                  }}
                  className="form-stack rounded-lg border border-border p-4 md:grid-cols-2"
                >
                  <Input name="name" defaultValue={u.name} />
                  <Input name="email" type="email" defaultValue={u.email} />
                  <Select name="role" defaultValue={u.role}>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="artist">Kunstenaar</option>
                  </Select>
                  <Input
                    name="password"
                    type="password"
                    placeholder="Nieuw wachtwoord (optioneel)"
                    minLength={8}
                  />
                  <Button type="submit" variant="outline" className="md:col-span-2 sm:max-w-xs">
                    Opslaan
                  </Button>
                </form>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin(session) && (
        <Card>
          <CardHeader>
            <CardTitle>E-mail (Mailjet)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted space-y-2">
            <p>
              Status:{" "}
              <span className={mailjetReady ? "text-emerald-400" : "text-amber-400"}>
                {mailjetReady ? "Mailjet gekoppeld" : "Nog niet gekoppeld"}
              </span>
            </p>
            <p>
              Wachtwoord vergeten werkt pas automatisch per mail als je Mailjet env vars instelt
              in Vercel (.env.example). Zonder Mailjet kan admin wachtwoorden resetten hierboven.
            </p>
          </CardContent>
        </Card>
      )}

      {isAdmin(session) && (
        <Card>
          <CardHeader>
            <CardTitle>Avada webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Status:{" "}
              <span className={webhookReady ? "text-emerald-400" : "text-amber-400"}>
                {webhookReady ? "WEBHOOK_SECRET ingesteld" : "WEBHOOK_SECRET ontbreekt in Vercel"}
              </span>
            </p>
            <div className="space-y-1">
              <p className="font-medium text-foreground">URL voor Avada-formulier (Action → Webhook)</p>
              <p className="break-all rounded-md border border-border bg-background/50 p-3 font-mono text-xs text-foreground">
                {avadaWebhookUrl}
              </p>
              <p className="text-muted">
                Plak deze URL in elk Avada-formulier. Het secret zit in de query string — Avada kan
                geen custom headers. Nu alleen <strong>capture</strong>: payloads worden opgeslagen
                hieronder. Verwerking naar leads/orders volgt later (
                <code className="text-foreground">WEBHOOK_PROCESS=true</code> in Vercel).
              </p>
            </div>
            {webhookCaptures.length === 0 ? (
              <p className="text-muted">Nog geen formulieren ontvangen. Dien een test in op de website.</p>
            ) : (
              <div className="space-y-3">
                <p className="font-medium text-foreground">
                  Laatste ontvangen ({webhookCaptures.length})
                </p>
                {webhookCaptures.slice(0, 5).map((capture) => (
                  <details
                    key={capture.id}
                    className="rounded-md border border-border bg-background/30 p-3"
                  >
                    <summary className="cursor-pointer text-foreground">
                      {new Date(capture.receivedAt).toLocaleString("nl-NL")} —{" "}
                      {Object.keys(capture.flat).length} velden ({capture.contentType})
                    </summary>
                    <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-muted">
                      {JSON.stringify(capture.flat, null, 2)}
                    </pre>
                  </details>
                ))}
              </div>
            )}
            {webhookProcessing && (
              <p className="text-emerald-400">WEBHOOK_PROCESS=true — automatische verwerking staat aan.</p>
            )}
          </CardContent>
        </Card>
      )}

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
              className="form-inline"
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
          </CardContent>
        </Card>
      )}
      {isAdmin(session) && (
        <Card>
          <CardHeader>
            <CardTitle>Werkbon-app integratie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              action={async (fd) => {
                "use server";
                await upsertSetting(
                  "workbon_integration_url",
                  (fd.get("workbon_integration_url") as string) ?? ""
                );
              }}
              className="form-inline"
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
    </div>
  );
}
