# Architectuur

## Checklist

| # | Onderdeel | Status |
|---|-----------|--------|
| 1 | GitHub repo | Lokaal git init |
| 2 | Vercel | Zie DEPLOYMENT.md |
| 3 | Domein + DNS (app / artist / status) | Door jou te koppelen |
| 4 | Turso database | `TURSO_*` env vars |
| 5 | Vercel Blob | `BLOB_READ_WRITE_TOKEN` |
| 6 | Auth.js | `AUTH_SECRET`, `AUTH_URL` |
| 7 | OpenAI | Optioneel voor uitgebreide AI |

## Diagram

```
Gebruikers → Vercel (Next.js) → Turso + Vercel Blob
                ↓
            OpenAI (optioneel)
```

## Subdomeinen

- `app.*` — admin/staff dashboard
- `artist.*` — kunstenaarsportaal
- `status.*` — klant token-URLs

Middleware routeert op `Host` header.

## Lokaal ontwikkelen

```bash
cp .env.example .env.local
npm run db:push
npm run db:seed
npm run dev
```

Login: `admin@champagneisart.nl` / `admin123`
