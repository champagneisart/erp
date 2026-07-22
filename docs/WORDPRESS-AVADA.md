# Avada formulieren → ERP webhook

Avada kan per formulier een **Webhook URL** instellen (Form Actions). Geen WordPress-plugin nodig.

## URL (kopieer uit ERP → Instellingen → Avada webhook)

```
https://erp-gamma-peach.vercel.app/api/webhooks/forms?secret=JOUW_WEBHOOK_SECRET
```

Het secret staat in de URL omdat Avada geen custom Authorization-headers ondersteunt.

## Vercel

```env
WEBHOOK_SECRET=<openssl rand -base64 32>
```

Optioneel later, als mapping klaar is:

```env
WEBHOOK_PROCESS=true
```

Zonder `WEBHOOK_PROCESS` worden payloads **alleen opgeslagen** (capture-modus) — zichtbaar in ERP → Instellingen.

## Avada instellen

1. Bewerk formulier in Avada
2. **Form Actions** → **Webhook**
3. Plak de URL uit Instellingen
4. Sla op en dien een test in

## Wat je ziet in het ERP

Na een testsubmission: **Instellingen → Avada webhook → Laatste ontvangen**. Daar staan alle veldnamen en waarden zoals Avada ze stuurt. Daarmee bouwen we de mapping (contact, aanvraag, ontwerpdetails, …).

## Test via curl

```bash
curl -X POST "https://erp-gamma-peach.vercel.app/api/webhooks/forms?secret=JOUW_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"form_id":"4257","naam":"Test","email":"test@example.com"}'
```

Verwacht: `{"ok":true,"mode":"capture",...}`
