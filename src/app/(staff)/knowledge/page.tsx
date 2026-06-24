import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { kbArticles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createKnowledgeArticle,
  listKnowledgeFiles,
  uploadKnowledgeFile,
} from "@/lib/actions/knowledge";

export default async function KnowledgePage() {
  const session = await auth();
  const articles = await db.select().from(kbArticles).orderBy(desc(kbArticles.updatedAt));
  const files = await listKnowledgeFiles();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Kennisbank</h1>
      <p className="text-sm text-muted">
        Gebruikt door AI-agents voor tone of voice, FAQ en regels.{" "}
        {isAdmin(session) ? "Admin kan artikelen bewerken (MVP: via database seed)." : ""}
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
            className="grid gap-3"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Input name="title" placeholder="Titel" required />
              <Input name="category" placeholder="Categorie" required />
              <Input name="tags" placeholder="Tags (comma)" />
            </div>
            <textarea
              name="content"
              className="min-h-24 rounded-md border border-gold/25 p-2 text-sm"
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
          <form action={uploadKnowledgeFile} className="grid gap-3 md:grid-cols-3">
            <Input name="title" placeholder="Titel van bestand" required />
            <input
              name="file"
              type="file"
              required
              className="h-10 rounded-md border border-gold/25 px-3 py-1 text-sm"
            />
            <Button type="submit" variant="outline">
              Upload
            </Button>
          </form>
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
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm text-foreground">{a.content}</pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
