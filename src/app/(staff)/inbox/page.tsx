import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messageDrafts, messages } from "@/db/schema";
import { createInboundMessage } from "@/lib/actions/inbox";
import { MailDraftPanel } from "@/components/inbox/mail-draft-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="page-content space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Inbox</h1>
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
            className="form-stack"
          >
            <Input name="subject" placeholder="Onderwerp" />
            <Textarea
              name="body"
              required
              placeholder="Plak e-mail of WhatsApp-bericht hier..."
              className="min-h-32"
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
                <MailDraftPanel
                  emailBody={draft.body}
                  internalNotes={draft.internalNotes}
                  approved={draft.approved}
                  draftId={draft.id}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
