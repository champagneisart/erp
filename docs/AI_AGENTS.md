# AI Agents (fase 7–8)

MVP bevat rule-based AI in `src/lib/ai/`. Later: OpenAI + dunne agent-wrappers.

## Agents

| Agent | Functies | Rechten |
|-------|----------|---------|
| Inbox | classifyIncomingMessage, generateCustomerReply | drafts only |
| CRM | extractLeadData | suggest customer match |
| Aanvraag | extractLeadData, checkMissingOrderInfo | update lead (met approve) |
| Communicatie | generateCustomerReply | drafts only |
| Ontwerp/Werkbon | generateWorkInstructionFromText | draft work_instruction |
| Planning | suggestNextTask | read-only suggest |
| Voorraad | checkInventoryForOrder | alerts |
| Factuur | suggestPaymentReminder | drafts |
| QC | validateOrderCompleteness | block transition suggest |

## Regels

- Alle AI via `src/lib/ai/*` — nooit direct vanuit UI
- Geen automatische statuswijziging zonder menselijke bevestiging (MVP)
- Kennisbank (`kb_articles`) als prompt-context

## Automatisering (fase 8)

- Vercel Cron voor taken/herinneringen
- Gmail webhook → messages tabel
- Escalatie uit kb_articles

## OpenAI

Zet `OPENAI_API_KEY` en vervang rule-based classify/reply met API calls + zelfde interfaces.
