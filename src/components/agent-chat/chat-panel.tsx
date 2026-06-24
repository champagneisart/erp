"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  getChatMessages,
  sendChatMessage,
  startAgentChat,
  type ChatMessageDto,
} from "@/lib/actions/agent-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AgentOption = { id: number; name: string; slug: string; purpose: string };

export function AgentChatPanel({ agents }: { agents: AgentOption[] }) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function beginChat(agentId: number) {
    startTransition(async () => {
      const id = await startAgentChat(agentId);
      const msgs = await getChatMessages(id);
      setSessionId(id);
      setMessages(msgs);
    });
  }

  function submitText(text: string, yesNo?: "yes" | "no") {
    if (!sessionId) return;
    if (!yesNo && !text.trim()) return;

    startTransition(async () => {
      const msgs = await sendChatMessage(sessionId, text.trim(), { yesNo });
      setMessages(msgs);
      setInput("");
    });
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const showYesNo = lastAssistant?.questionType === "yes_no" && !pending;

  return (
    <div className="app-card flex h-[calc(100vh-14rem)] flex-col overflow-hidden">
      {!sessionId ? (
        <div className="flex flex-1 flex-col gap-4 p-6">
          <p className="text-sm text-muted">
            Start met de <strong className="text-gold-bright">Meester Agent</strong> — die overlegt
            intern met alle specialisten voordat hij antwoordt.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => beginChat(agent.id)}
                disabled={pending}
                className={cn(
                  "app-card rounded-xl p-4 text-left transition",
                  agent.slug === "master"
                    ? "border-gold/50 bg-gold/5 hover:border-gold"
                    : "hover:border-gold/40"
                )}
              >
                <p className="font-medium text-foreground">
                  {agent.name}
                  {agent.slug === "master" && (
                    <span className="ml-2 text-xs font-normal text-gold">aanbevolen</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted">{agent.purpose}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-gold/15 px-4 py-3">
            <p className="text-sm font-medium text-foreground">Agent test-chat</p>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setSessionId(null);
                setMessages([]);
              }}
            >
              Nieuwe chat
            </Button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[90%] rounded-xl px-4 py-3 text-sm",
                  m.role === "user"
                    ? "ml-auto bg-gradient-to-b from-gold-bright to-gold text-[#0a0a0b]"
                    : "border border-gold/15 bg-card-elevated text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.internalDeliberation && m.internalDeliberation.length > 0 && (
                  <details className="mt-3 rounded-lg border border-gold/20 bg-black/30 p-2 text-xs">
                    <summary className="cursor-pointer font-medium text-gold">
                      Intern overleg ({m.internalDeliberation.length} agents)
                    </summary>
                    <ul className="mt-2 space-y-1 text-muted">
                      {m.internalDeliberation.map((d, i) => (
                        <li key={i}>
                          <strong className="text-gold-dim">{d.agent}:</strong> {d.note}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
            {pending && (
              <div className="max-w-[85%] rounded-xl border border-gold/15 bg-card-elevated px-4 py-2 text-sm text-muted">
                Meester Agent overlegt met specialisten...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gold/15 p-4">
            {showYesNo && (
              <div className="mb-3 flex gap-2">
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => submitText("", "yes")}
                  disabled={pending}
                >
                  Ja
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => submitText("", "no")}
                  disabled={pending}
                >
                  Nee
                </Button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitText(input);
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Typ je antwoord..."
                disabled={pending || showYesNo}
              />
              <Button
                type="submit"
                className="rounded-full"
                disabled={pending || showYesNo || !input.trim()}
              >
                Verstuur
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
