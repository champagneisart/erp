import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messageDrafts, messages } from "@/db/schema";
import { createInboundMessage, approveDraft } from "@/lib/actions/inbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function InboxPage() {
  const rows = await db
    .select({ message: messages, draft: messageDrafts })
    .from(messages)
    .leftJoin(messageDrafts, eq(messageDrafts.messageId, messages.id))
    .orderBy(desc(messages.createdAt))
    .limit(20);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bericht plakken (handmatig)</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await createInboundMessage({
                body: fd.get("body") as string,
                subject: (fd.get("subject") as string) || undefined,
                channel: "manual",
              });
            }}
            className="space-y-3"
          >
            <input
              name="subject"
              placeholder="Onderwerp"
              className="h-10 w-full rounded-md border px-3 text-sm"
            />
            <textarea
              name="body"
              required
              placeholder="Plak e-mail of WhatsApp-bericht hier..."
              className="min-h-32 w-full rounded-md border p-3 text-sm"
            />
            <Button type="submit">Analyseren & concept maken</Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {rows.map(({ message, draft }) => (
          <Card key={message.id}>
            <CardHeader>
              <CardTitle className="text-base">{message.subject ?? "Geen onderwerp"}</CardTitle>
              <Badge>{message.classification ?? "—"}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap text-foreground">{message.body}</p>
              {draft && (
                <div className="rounded-md bg-gold/10 p-3">
                  <p className="mb-2 font-medium text-gold-bright">AI-concept</p>
                  <pre className="whitespace-pre-wrap font-sans text-foreground">{draft.body}</pre>
                  {!draft.approved && (
                    <form
                      action={async () => {
                        "use server";
                        await approveDraft(draft.id);
                      }}
                      className="mt-2"
                    >
                      <Button type="submit" variant="secondary">
                        Concept goedkeuren (kopiëren)
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
