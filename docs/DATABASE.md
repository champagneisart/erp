# Database

## Engine

**Neon** (PostgreSQL) via Drizzle ORM + `@neondatabase/serverless`.

Eén cloud-database voor lokaal én productie — overal dezelfde data op afstand.

## Environment

```bash
DATABASE_URL=postgresql://...@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

Zet dit in:
- `.env.local` (lokaal)
- Vercel → Project → Environment Variables (productie)

## Setup Neon

1. Account op [neon.tech](https://neon.tech)
2. Nieuw project, bijv. `champagne-studio`
3. Kopieer **Connection string** (pooled aanbevolen voor serverless/Vercel)
4. Plak in `DATABASE_URL`

## Migraties

```bash
npm run db:push      # schema naar Neon pushen
npm run db:seed      # demo-users + voorbeelddata (eenmalig)
```

## Neon Console

Beheer tabellen en SQL via het Neon dashboard — handig om op afstand data te bekijken.

## Backup

Neon heeft ingebouwde point-in-time recovery (afhankelijk van plan). Voor export:

```bash
pg_dump "$DATABASE_URL" > backup.sql
```
