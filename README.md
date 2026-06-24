# Champagne is Art Studio

Intern CRM- en productiesysteem: klanten, aanvragen, orders, voorraad, kunstenaarsportaal, klantstatus, inbox met AI-concepten.

## Stack

- Next.js 16 + TypeScript + Tailwind
- Drizzle ORM + Neon (PostgreSQL)
- Auth.js
- Vercel Blob (bestanden, optioneel)
- Deploy: Vercel + subdomeinen `app` / `artist` / `status`

## Lokaal starten

```bash
cd ~/Projects/champagne-is-art-studio
cp .env.example .env.local   # pas AUTH_SECRET aan voor productie
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

| Account | Wachtwoord | Rol |
|---------|------------|-----|
| admin@champagneisart.nl | admin123 | admin |
| artist@champagneisart.nl | artist123 | kunstenaar |

## Documentatie

- [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/DATABASE.md](docs/DATABASE.md)
- [docs/AI_AGENTS.md](docs/AI_AGENTS.md)

## Scripts

| Script | Doel |
|--------|------|
| `npm run dev` | Development server |
| `npm run build` | Productie build |
| `npm run db:push` | Schema naar database |
| `npm run db:seed` | Demo-data + admin user |

## Routes

- `/dashboard` — staff overzicht
- `/customers`, `/leads`, `/orders` — CRM
- `/inventory`, `/planning`, `/tasks`, `/inbox`, `/knowledge`
- `/artist` — kunstenaarsportaal
- `/portal/[token]` — klantstatus (publiek)
