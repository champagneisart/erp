import { AgentChatPanel } from "@/components/agent-chat/chat-panel";
import { listAgentsForChat, listRecentChatSessions } from "@/lib/actions/agent-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function AgentChatPage() {
  const agents = await listAgentsForChat();
  const recent = await listRecentChatSessions();

  return (
    <div className="page-content space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Agent test-chat</h1>
        <p className="text-sm text-muted">
          Test agents in een gesprek. De agent stelt vragen, toont ja/nee-knoppen waar nodig, en kan
          klanten en aanvragen direct aanmaken.
        </p>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <AgentChatPanel
            agents={agents.map((a) => ({
              id: a.id,
              name: a.name,
              slug: a.slug,
              purpose: a.purpose,
            }))}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recente test-chats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recent.length === 0 && (
              <p className="text-muted">Nog geen chats. Start er een links.</p>
            )}
            {recent.map(({ chat, agent }) => (
              <div key={chat.id} className="rounded border border-gold/10 p-2">
                <p className="font-medium">{agent.name}</p>
                <p className="text-muted">{chat.status}</p>
                {chat.leadId && (
                  <Link href={`/leads/${chat.leadId}`} className="text-gold underline">
                    Aanvraag #{chat.leadId}
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
