"use server";

import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  agentChatMessages,
  agentChatSessions,
  aiAgentProfiles,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertStaff } from "@/lib/auth/permissions";
import { ensureDefaultAgents } from "@/lib/actions/ai-studio";
import {
  getLeadAgentGreeting,
  isPendingConfirmation,
  processLeadAgentTurn,
} from "@/lib/ai/agent-chat";
import {
  getMasterAgentGreeting,
  isMasterPendingConfirmation,
  processMasterAgentTurn,
  serializeMasterState,
} from "@/lib/ai/master-agent";
import {
  getPricingAgentGreeting,
  processPricingAgentTurn,
} from "@/lib/ai/pricing-agent";

export type ChatMessageDto = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  questionType?: "text" | "yes_no" | "choice" | null;
  options?: string[] | null;
  internalDeliberation?: Array<{ agent: string; note: string }> | null;
};

async function getSessionForUser(sessionId: number, userId: number) {
  const [row] = await db
    .select()
    .from(agentChatSessions)
    .where(eq(agentChatSessions.id, sessionId))
    .limit(1);
  if (!row || row.userId !== userId) throw new Error("Sessie niet gevonden");
  return row;
}

export async function listAgentsForChat() {
  await ensureDefaultAgents();
  const agents = await db
    .select()
    .from(aiAgentProfiles)
    .where(eq(aiAgentProfiles.isActive, true));

  return agents.sort((a, b) => {
    if (a.slug === "master") return -1;
    if (b.slug === "master") return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function startAgentChat(agentId: number) {
  const session = await auth();
  assertStaff(session);
  const userId = Number(session!.user!.id);

  const [agent] = await db
    .select()
    .from(aiAgentProfiles)
    .where(eq(aiAgentProfiles.id, agentId))
    .limit(1);
  if (!agent) throw new Error("Agent niet gevonden");

  const [chatSession] = await db
    .insert(agentChatSessions)
    .values({
      agentId,
      userId,
      status: "active",
      collectedData: JSON.stringify({ lead: {} }),
    })
    .returning();

  let greeting = "Hoi! Waar kan ik je mee helpen?";
  let questionType: "text" | "yes_no" | "choice" | undefined = "text";

  if (agent.slug === "lead_processing") {
    const g = await getLeadAgentGreeting();
    greeting = g.content;
    questionType = g.questionType;
  } else if (agent.slug === "master") {
    const g = await getMasterAgentGreeting();
    greeting = g.content;
    questionType = g.questionType;
  } else if (agent.slug === "pricing") {
    const g = getPricingAgentGreeting();
    greeting = g.content;
    questionType = g.questionType;
  }

  await db.insert(agentChatMessages).values({
    sessionId: chatSession.id,
    role: "assistant",
    content: greeting,
    questionType,
  });

  revalidatePath("/agent-chat");
  return chatSession.id;
}

export async function getChatMessages(sessionId: number): Promise<ChatMessageDto[]> {
  const session = await auth();
  assertStaff(session);
  await getSessionForUser(sessionId, Number(session!.user!.id));

  const rows = await db
    .select()
    .from(agentChatMessages)
    .where(eq(agentChatMessages.sessionId, sessionId))
    .orderBy(asc(agentChatMessages.createdAt));

  return rows.map((m) => {
    let deliberation: ChatMessageDto["internalDeliberation"] = null;
    let yesNo: string[] | null = null;

    if (m.options) {
      try {
        const parsed = JSON.parse(m.options) as {
          yesNo?: string[];
          deliberation?: Array<{ agent: string; note: string }>;
        };
        if (parsed.deliberation) deliberation = parsed.deliberation;
        if (parsed.yesNo) yesNo = parsed.yesNo;
        if (Array.isArray(parsed) && typeof parsed[0] === "string") {
          yesNo = parsed as string[];
        }
      } catch {
        deliberation = null;
      }
    }

    return {
      id: m.id,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      questionType: m.questionType as ChatMessageDto["questionType"],
      options: yesNo,
      internalDeliberation: deliberation,
    };
  });
}

export async function sendChatMessage(
  sessionId: number,
  content: string,
  options?: { yesNo?: "yes" | "no" }
) {
  const session = await auth();
  assertStaff(session);
  const userId = Number(session!.user!.id);

  const chatSession = await getSessionForUser(sessionId, userId);
  const [agent] = await db
    .select()
    .from(aiAgentProfiles)
    .where(eq(aiAgentProfiles.id, chatSession.agentId))
    .limit(1);

  const displayContent =
    options?.yesNo === "yes" ? "Ja" : options?.yesNo === "no" ? "Nee" : content;

  await db.insert(agentChatMessages).values({
    sessionId,
    role: "user",
    content: displayContent,
    questionType: options?.yesNo ? "yes_no" : "text",
  });

  const history = await db
    .select()
    .from(agentChatMessages)
    .where(eq(agentChatMessages.sessionId, sessionId))
    .orderBy(desc(agentChatMessages.createdAt));

  const userMessages = history
    .filter(
      (m) =>
        m.role === "user" && m.content !== "Ja" && m.content !== "Nee"
    )
    .map((m) => m.content)
    .reverse();
  const conversationContext = userMessages.join("\n\n");

  const lastAssistant = history.find((m) => m.role === "assistant") ?? null;
  const pendingLead = isPendingConfirmation(lastAssistant);
  const pendingMaster = isMasterPendingConfirmation(lastAssistant);
  const pending = pendingLead || pendingMaster;

  let replyContent = "Ik begrijp het. Kun je meer details geven?";
  let questionType: "text" | "yes_no" | "choice" | undefined = "text";
  let collected = chatSession.collectedData ?? "{}";
  let deliberation: Array<{ agent: string; note: string }> = [];
  let createdCustomerId: number | undefined;
  let createdLeadId: number | undefined;
  let action: "create_customer_lead" | "none" = "none";

  if (agent?.slug === "master") {
    const reply = await processMasterAgentTurn({
      userMessage: content,
      stateRaw: collected,
      isYesNoAnswer: options?.yesNo,
      pendingConfirm: pendingMaster,
    });
    replyContent = reply.content;
    questionType = reply.questionType;
    deliberation = reply.internalDeliberation;
    collected = reply.stateJson;
    action = reply.action ?? "none";
    createdCustomerId = reply.createdCustomerId;
    createdLeadId = reply.createdLeadId;
  } else if (agent?.slug === "pricing") {
    replyContent = await processPricingAgentTurn(content);
    questionType = "text";
  } else if (agent?.slug === "lead_processing") {
    const reply = await processLeadAgentTurn({
      userMessage: content,
      collectedRaw: collected,
      conversationContext,
      isYesNoAnswer: options?.yesNo,
      pendingConfirm: pending,
    });
    replyContent = reply.content;
    questionType = reply.questionType;
    collected = reply.stateJson;
    action = reply.action ?? "none";
    createdCustomerId = reply.createdCustomerId;
    createdLeadId = reply.createdLeadId;
  }

  if (action === "create_customer_lead") {
    await db
      .update(agentChatSessions)
      .set({
        status: "completed",
        collectedData: collected,
        customerId: createdCustomerId ?? null,
        leadId: createdLeadId ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agentChatSessions.id, sessionId));
  } else {
    await db
      .update(agentChatSessions)
      .set({
        collectedData: collected,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agentChatSessions.id, sessionId));
  }

  const optionsPayload = JSON.stringify({
    yesNo: questionType === "yes_no" ? ["Ja", "Nee"] : null,
    deliberation: deliberation.length > 0 ? deliberation : null,
  });

  await db.insert(agentChatMessages).values({
    sessionId,
    role: "assistant",
    content: replyContent,
    questionType,
    options: optionsPayload,
  });

  revalidatePath("/agent-chat");
  revalidatePath("/customers");
  revalidatePath("/leads");

  return getChatMessages(sessionId);
}

export async function listRecentChatSessions() {
  const session = await auth();
  assertStaff(session);
  const userId = Number(session!.user!.id);

  return db
    .select({
      chat: agentChatSessions,
      agent: aiAgentProfiles,
    })
    .from(agentChatSessions)
    .innerJoin(aiAgentProfiles, eq(agentChatSessions.agentId, aiAgentProfiles.id))
    .where(eq(agentChatSessions.userId, userId))
    .orderBy(desc(agentChatSessions.updatedAt))
    .limit(10);
}
