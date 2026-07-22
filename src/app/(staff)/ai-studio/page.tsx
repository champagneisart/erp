import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgentProfiles, aiTrainingFiles, aiTrainingItems } from "@/db/schema";
import {
  addTrainingItem,
  ensureDefaultAgents,
  saveAgentPrompt,
  uploadAiTrainingFile,
} from "@/lib/actions/ai-studio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

export default async function AiStudioPage() {
  await ensureDefaultAgents();

  const agents = await db.select().from(aiAgentProfiles).orderBy(aiAgentProfiles.name);
  const trainings = await db
    .select({
      item: aiTrainingItems,
      agent: aiAgentProfiles,
    })
    .from(aiTrainingItems)
    .leftJoin(aiAgentProfiles, eq(aiTrainingItems.agentId, aiAgentProfiles.id))
    .orderBy(desc(aiTrainingItems.createdAt))
    .limit(30);
  const trainingFiles = await db
    .select({
      file: aiTrainingFiles,
      agent: aiAgentProfiles,
    })
    .from(aiTrainingFiles)
    .leftJoin(aiAgentProfiles, eq(aiTrainingFiles.agentId, aiAgentProfiles.id))
    .orderBy(desc(aiTrainingFiles.createdAt))
    .limit(30);

  return (
    <div className="page-content space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">AI Studio</h1>
      <p className="text-sm text-muted">
        Beheer aparte agents, voer trainingsdata in en stuur prompts per domein.{" "}
        <Link href="/agent-chat" className="text-gold underline">
          Open Agent test-chat →
        </Link>
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader>
              <CardTitle>{agent.name}</CardTitle>
              <p className="text-sm text-muted">{agent.purpose}</p>
            </CardHeader>
            <CardContent>
              <form
                action={async (fd) => {
                  "use server";
                  await saveAgentPrompt(
                    agent.id,
                    (fd.get("systemPrompt") as string) ?? ""
                  );
                }}
                className="form-stack"
              >
                <Textarea
                  name="systemPrompt"
                  defaultValue={agent.systemPrompt ?? ""}
                  className="min-h-80 font-mono"
                  placeholder="System prompt / werkinstructie voor deze agent"
                />
                {agent.slug === "pricing" && (
                  <p className="text-xs text-muted">
                    Plak hier je volledige prijstabellen en rekenregels (inkoop fles +
                    beschildering, staffels, BTW, marges).
                  </p>
                )}
                <Button type="submit" variant="outline">
                  Prompt opslaan
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trainingsdata toevoegen</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              const agentId = fd.get("agentId") as string;
              await addTrainingItem({
                agentId: agentId ? Number(agentId) : undefined,
                title: fd.get("title") as string,
                category: fd.get("category") as string,
                content: fd.get("content") as string,
                source: "manual",
              });
            }}
            className="form-stack"
          >
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
              <Select name="agentId">
                <option value="">Algemeen (voor alle agents)</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </Select>
              <Input name="title" placeholder="Titel" required />
              <Input
                name="category"
                placeholder="Categorie (pricing, tone, faq...)"
                required
              />
            </div>
            <Textarea
              name="content"
              className="min-h-28"
              placeholder="Regels, voorbeelden, uitzonderingen, producten, prijzen..."
              required
            />
            <Button type="submit">Trainingsitem opslaan</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Bestanden voor AI Studio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={uploadAiTrainingFile} className="form-stack md:grid-cols-4">
            <Select name="agentId">
              <option value="">Algemeen</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
            <Input name="title" placeholder="Titel bestand" required />
            <input name="file" type="file" required className="field-file" />
            <Button type="submit" variant="outline">
              Upload
            </Button>
          </form>
          {trainingFiles.length > 0 && (
            <div className="space-y-2">
              {trainingFiles.map(({ file, agent }) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm text-gold underline"
                >
                  {file.title} - {agent?.name ?? "Algemeen"} - {file.fileName}
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recente trainingsitems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trainings.map(({ item, agent }) => (
            <div key={item.id} className="rounded-md border border-gold/20 p-3">
              <p className="text-sm font-medium">
                {item.title}{" "}
                <span className="font-normal text-muted">
                  ({item.category}) - {agent?.name ?? "Algemeen"}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {item.content}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
