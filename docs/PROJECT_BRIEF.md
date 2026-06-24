# Champagne is Art Studio — Project Brief

## Doel

Intern systeem voor klanten, aanvragen, orders, voorraad, kunstenaarsplanning, werkbonnen, klantcommunicatie en AI-agents. Minder handmatig mailen, minder zoeken, meer automatische opvolging.

## Modules (MVP)

- CRM (klanten, bestanden, notities)
- Aanvragen (leads) met statusflow
- Orders met werkbon, kunstenaar, factuurstatus
- Voorraad met reserveren/afboeken
- Planning (kunstenaar + deadlines)
- Kunstenaarsportaal (`/artist`)
- Klantstatuspagina (`/portal/[token]`)
- Taken
- Inbox (handmatig plakken + AI-concept)
- Kennisbank (AI tone of voice)

## Rollen

| Rol | Toegang |
|-----|---------|
| admin | Alles + instellingen |
| staff | Operatie (geen systeeminstellingen) |
| artist | Eigen orders, events |
| public | Token-URL statuspagina |

## Statussen

Zie `src/lib/constants/statuses.ts` — enige bron van waarheid.

## Stack

Next.js, Drizzle, Turso, Auth.js, Vercel Blob, Vercel hosting met subdomeinen.

## Later (niet MVP)

Gmail/WhatsApp, Mollie, pgvector RAG, volledige agent-automatisering.
