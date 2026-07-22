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
  isWebhookConfigured,
} from "@/lib/webhooks/config";
import { getWebhookCaptures, isWebhookProcessingEnabled } from "@/lib/webhooks/capture";
import { resolveAvadaFormTypeDetailed } from "@/lib/webhooks/avada-forms";
import { processStoredWebhookCaptures } from "@/lib/actions/webhooks";
import { eq } from "drizzle-orm";
import {
  OPENAI_CHAT_MODELS,
  OPENAI_EMBEDDING_MODELS,
  getOpenAiChatModel,
  getOpenAiEmbeddingModel,
  isOpenAiKeyFromEnv,
} from "@/lib/ai/config";
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
  const [chatModelSetting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "openai_chat_model"))
    .limit(1);
  const [embeddingModelSetting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "openai_embedding_model"))
    .limit(1);
  const activeChatModel = await getOpenAiChatModel();
  const activeEmbeddingModel = await getOpenAiEmbeddingModel();
  const keyFromEnv = isOpenAiKeyFromEnv();
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
            <p>
              Verwerking:{" "}
              <span className={webhookProcessing ? "text-emerald-400" : "text-amber-400"}>
                {webhookProcessing
                  ? "Aan — nieuwe formulieren → Aanvragen/Orders"
                  : "Alleen capture (WEBHOOK_CAPTURE=true)"}
              </span>
            </p>
            <div className="space-y-1">
              <p className="font-medium text-foreground">WordPress-plugin (CIA ERP Webhook)</p>
              <p className="text-muted">
                Formulieren komen binnen via de plugin (database + CIA ERP actie). Geen Send To URL
                meer nodig. Onderstaande captures zijn het logboek.
              </p>
            </div>
            {webhookCaptures.length > 0 && (
              <form
                action={async () => {
                  "use server";
                  await processStoredWebhookCaptures();
                }}
              >
                <Button type="submit" variant="secondary">
                  Opgeslagen captures verwerken naar Aanvragen
                </Button>
                <p className="mt-2 text-xs text-muted">
                  Eenmalig: verwerk alles wat al binnenkwam vóór automatische verwerking. Slaat
                  plugin-test over.
                </p>
              </form>
            )}
            {webhookCaptures.length === 0 ? (
              <p className="text-muted">Nog geen formulieren ontvangen. Dien een test in op de website.</p>
            ) : (
              <div className="space-y-3">
                <p className="font-medium text-foreground">
                  Laatste ontvangen ({webhookCaptures.length})
                </p>
                {webhookCaptures.slice(0, 5).map((capture) => {
                  const detected = resolveAvadaFormTypeDetailed(
                    capture.flat.form_id,
                    capture.flat.form_name,
                    capture.flat
                  );
                  return (
                  <details
                    key={capture.id}
                    className="rounded-md border border-border bg-background/30 p-3"
                  >
                    <summary className="cursor-pointer text-foreground">
                      {new Date(capture.receivedAt).toLocaleString("nl-NL")} —{" "}
                      {detected.type ?? "?"} ({capture.flat.form_id ?? "geen id"}) —{" "}
                      {Object.keys(capture.flat).length} velden
                    </summary>
                    <p className="mt-2 text-xs text-muted">{detected.reason}</p>
                    <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-muted">
                      {JSON.stringify(capture.flat, null, 2)}
                    </pre>
                  </details>
                  );
                })}
              </div>
            )}
            {!webhookProcessing && (
              <p className="text-amber-400">
                Zet WEBHOOK_CAPTURE niet op true — verwerking staat standaard aan na deploy.
              </p>
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
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              API-key in Vercel als{" "}
              <code className="text-foreground">OPENAI_API_KEY</code> heeft voorrang op het
              veld hieronder. Chat-agents gebruiken het <strong className="font-normal text-foreground">chatmodel</strong>;
              embedding-modellen zijn voor toekomstige zoek/RAG (zoals in chatbot-tools).
            </p>
            {keyFromEnv && (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                API-key komt uit omgevingsvariabele (Vercel). Het wachtwoordveld hieronder is
                optioneel/backup.
              </p>
            )}
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
                placeholder="sk-... (of leeg als OPENAI_API_KEY in Vercel staat)"
                disabled={keyFromEnv}
              />
              <Button type="submit" variant="outline" disabled={keyFromEnv}>
                Key opslaan
              </Button>
            </form>
            <form
              action={async (fd) => {
                "use server";
                await upsertSetting(
                  "openai_chat_model",
                  (fd.get("openai_chat_model") as string) ?? "gpt-4o-mini"
                );
                await upsertSetting(
                  "openai_embedding_model",
                  (fd.get("openai_embedding_model") as string) ??
                    "text-embedding-3-small"
                );
              }}
              className="form-stack border-t border-gold/10 pt-4"
            >
              <p className="text-sm font-medium">Modellen</p>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted">
                    Chatmodel (agents, extractie, inbox)
                  </label>
                  <Select
                    name="openai_chat_model"
                    defaultValue={chatModelSetting?.value ?? activeChatModel}
                  >
                    {OPENAI_CHAT_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-xs text-muted">
                    Actief: {activeChatModel}
                    {process.env.OPENAI_MODEL ? " (via env OPENAI_MODEL)" : ""}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">
                    Embeddingmodel (kennisbank-zoek, nog niet live)
                  </label>
                  <Select
                    name="openai_embedding_model"
                    defaultValue={embeddingModelSetting?.value ?? activeEmbeddingModel}
                  >
                    {OPENAI_EMBEDDING_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-xs text-muted">
                    Zoals text-embedding-3-small in chatbot-software — wordt opgeslagen voor
                    latere RAG; nu injecteren we tekst direct in prompts.
                  </p>
                </div>
              </div>
              <Button type="submit">Modellen opslaan</Button>
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
