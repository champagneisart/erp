import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { kbArticles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createKnowledgeArticle,
  linkKnowledgeArticleToAgent,
  listAgentsForKnowledge,
  listKnowledgeFiles,
  uploadKnowledgeFile,
} from "@/lib/actions/knowledge";
import { Select } from "@/components/ui/select";

export default async function KnowledgePage() {
  const session = await auth();
  const articles = await db.select().from(kbArticles).orderBy(desc(kbArticles.updatedAt));
  const files = await listKnowledgeFiles();
  const agents = await listAgentsForKnowledge();

  return (
    <div className="page-content space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Kennisbank</h1>
      <p className="text-sm text-muted">
        Gebruikt door AI-agents voor tone of voice, FAQ en regels. Upload{" "}
        <strong className="font-normal text-foreground">.md</strong> of{" "}
        <strong className="font-normal text-foreground">.txt</strong> — de tekst wordt automatisch
        een artikel. Koppel daarna handmatig aan een agent in AI Studio of via de knop hieronder.
        {isAdmin(session) ? " Admin kan artikelen bewerken (MVP: via database seed)." : ""}
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Kennisartikel toevoegen</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await createKnowledgeArticle({
                title: fd.get("title") as string,
                category: fd.get("category") as string,
                content: fd.get("content") as string,
                tags: (fd.get("tags") as string) || undefined,
              });
            }}
            className="form-stack"
          >
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
              <Input name="title" placeholder="Titel" required />
              <Input name="category" placeholder="Categorie" required />
              <Input name="tags" placeholder="Tags (comma)" />
            </div>
            <Textarea
              name="content"
              className="min-h-24"
              placeholder="Inhoud van de kennisbank"
              required
            />
            <Button type="submit">Artikel opslaan</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Kennisbank-bestanden uploaden</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={uploadKnowledgeFile} className="form-stack md:grid-cols-4">
            <Input name="title" placeholder="Titel (optioneel bij .md)" />
            <Input name="category" placeholder="Categorie (bijv. pricing, faq)" defaultValue="import" />
            <input
              name="file"
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              required
              className="field-file"
            />
            <Button type="submit" variant="outline">
              Upload .md / .txt
            </Button>
          </form>
          <p className="text-xs text-muted">
            PDF/Word: upload in AI Studio als bijlage; voor AI-gebruik werkt platte tekst of markdown
            het goedkoopst (minder tokens).
          </p>
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f) => (
                <a
                  key={f.id}
                  href={f.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm text-gold underline"
                >
                  {f.title} - {f.fileName}
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {articles.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {a.title}{" "}
                <span className="text-sm font-normal text-muted">({a.category})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-sm text-foreground">
                {a.content}
              </pre>
              {agents.length > 0 && (
                <form
                  action={linkKnowledgeArticleToAgent}
                  className="flex flex-wrap items-end gap-2 border-t border-gold/10 pt-4"
                >
                  <input type="hidden" name="articleId" value={a.id} />
                  <div className="min-w-[12rem] flex-1">
                    <label className="mb-1 block text-xs text-muted">Koppel aan agent</label>
                    <Select name="agentId" required>
                      <option value="">— Agent —</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="submit" variant="outline" className="text-xs sm:text-sm">
                    Toevoegen als trainingsdata
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
