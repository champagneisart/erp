# Deployment (Vercel)

## 1. Neon database

1. Maak account op [neon.tech](https://neon.tech)
2. Nieuw project `champagne-studio-prod`
3. Kopieer connection string → `DATABASE_URL`
4. Lokaal in `.env.local` zetten (zelfde DB of aparte Neon branch)

```bash
npm run db:push
npm run db:seed   # eenmalig
```

## 2. Vercel

1. Import GitHub repo
2. Environment variables:

```
DATABASE_URL=postgresql://...
AUTH_SECRET=
AUTH_URL=https://app.jouwdomein.nl
NEXT_PUBLIC_APP_HOST=app.jouwdomein.nl
NEXT_PUBLIC_ARTIST_HOST=artist.jouwdomein.nl
NEXT_PUBLIC_STATUS_HOST=status.jouwdomein.nl
BLOB_READ_WRITE_TOKEN=
OPENAI_API_KEY=
CRON_SECRET=
```

3. Deploy

Tip: koppel Neon direct via Vercel Integrations → Neon (zet `DATABASE_URL` automatisch).

## 3. Domeinen

Vercel → Project → Domains:

- `app.jouwdomein.nl`
- `artist.jouwdomein.nl`
- `status.jouwdomein.nl`

DNS bij registrar: CNAME naar Vercel.

## 4. Lokaal + remote

Met dezelfde `DATABASE_URL` werk je lokaal op de cloud-database. Wijzigingen zijn direct zichtbaar overal.

Voor veilig testen: maak in Neon een **branch** (dev) en gebruik die connection string lokaal.
