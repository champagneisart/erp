# Deployment (Vercel)

## 1. Neon database

1. Maak account op [neon.tech](https://neon.tech)
2. Nieuw project `champagne-studio-prod`
3. Kopieer **pooled** connection string → `DATABASE_URL`
4. Lokaal in `.env.local` zetten (zelfde DB of aparte Neon branch)

```bash
npm run db:push
npm run db:seed   # eenmalig — maakt admin@champagneisart.nl / admin123
```

## 2. Vercel — environment variables

### Fase A: alleen Vercel-URL (custom domain nog niet gekoppeld)

Gebruik de URL uit Vercel → Project → Domains, bijv. `https://erp-gamma-peach.vercel.app`.

**Verplicht:**

```
DATABASE_URL=postgresql://...-pooler...?sslmode=require
AUTH_SECRET=<min. 32 tekens, openssl rand -base64 32>
AUTH_URL=https://erp-gamma-peach.vercel.app
AUTH_TRUST_HOST=true
```

`AUTH_URL` moet **exact** overeenkomen met de URL waar gebruikers inloggen (geen trailing slash).  
Zet **niet** `AUTH_URL=https://app.champagneisart.nl` zolang dat domein nog niet aan Vercel hangt — login en sessiecookies breken dan.

`NEXT_PUBLIC_*_HOST` variabelen zijn **optioneel** in deze fase; middleware herkent `*.vercel.app` automatisch als app-host.

**Optioneel:**

```
BLOB_READ_WRITE_TOKEN=
OPENAI_API_KEY=
CRON_SECRET=
WEBHOOK_SECRET=
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
MAILJET_FROM_EMAIL=noreply@champagneisart.nl
MAILJET_FROM_NAME=Champagne is Art Studio
```

### Fase B: custom subdomains (later)

1. Koppel domeinen in Vercel → Domains
2. Update env vars:

```
AUTH_URL=https://app.champagneisart.nl
NEXT_PUBLIC_APP_HOST=app.champagneisart.nl
NEXT_PUBLIC_ARTIST_HOST=artist.champagneisart.nl
NEXT_PUBLIC_STATUS_HOST=status.champagneisart.nl
```

3. Redeploy

## 3. Deploy

1. Import GitHub repo in Vercel
2. Zet env vars (fase A of B)
3. Deploy
4. Test login op `/login`

**WordPress Avada formulieren:** zie [WORDPRESS-AVADA.md](./WORDPRESS-AVADA.md) — webhook `WEBHOOK_SECRET` verplicht.

**Cron (Hobby-plan):** OpenAI healthcheck draait 1× per dag (`0 7 * * *` UTC). Vaker vereist Vercel Pro, of test handmatig via Instellingen.

## 4. Domeinen (fase B)

Vercel → Project → Domains:

- `app.champagneisart.nl`
- `artist.champagneisart.nl`
- `status.champagneisart.nl`

DNS bij registrar: CNAME naar Vercel.

## 5. Admin seeden op productie-Neon

Als login “Onjuiste e-mail of wachtwoord” geeft met bekende credentials:

```bash
# Zet DATABASE_URL naar productie-Neon in .env.local
npm run db:push    # schema sync
npm run db:seed    # eenmalig — faalt als users al bestaan
```

Standaard admin: `admin@champagneisart.nl` / `admin123` — wijzig wachtwoord na eerste login.

## 6. Login troubleshooting

| Symptoom | Oorzaak | Fix |
|----------|---------|-----|
| Formulier blijft op /login, geen sessie | `AUTH_URL` wijst naar niet-gekoppeld domein | Zet `AUTH_URL` op actieve Vercel-URL |
| Altijd redirect naar /login na submit | `AUTH_SECRET` ontbreekt of gewijzigd | Zet vaste `AUTH_SECRET` in Vercel, redeploy |
| “Onjuiste e-mail of wachtwoord” | Geen user in Neon | `npm run db:seed` tegen productie-DB |
| Database error in logs | `DATABASE_URL` ontbreekt / verkeerd | Pooled Neon string in Vercel |

## 7. Lokaal + remote

Met dezelfde `DATABASE_URL` werk je lokaal op de cloud-database. Wijzigingen zijn direct zichtbaar overal.

Voor veilig testen: maak in Neon een **branch** (dev) en gebruik die connection string lokaal.
