# WordPress Avada → ERP webhooks

Alle Avada-formulieren sturen naar **één endpoint**. Het type formulier bepaalt wat het ERP doet.

```
POST https://app.champagneisart.nl/api/webhooks/forms
Authorization: Bearer <WEBHOOK_SECRET>
Content-Type: application/json
```

Alternatief header: `X-Webhook-Secret: <WEBHOOK_SECRET>`

## Formuliertypes

| Type | Wat gebeurt er in het ERP |
|------|---------------------------|
| `contact` | Klant + aanvraag + bericht in Inbox |
| `aanvraag` | Klant + aanvraag + taak voor staff + Inbox |
| `ontwerpdetails` | Werkbon/richtlijn op order (of taak als order nog niet bestaat) |

Type doorgeven via:
- Query: `?type=aanvraag`
- Hidden field in formulier: `form_type` = `contact` / `aanvraag` / `ontwerpdetails`
- JSON body: `"form_type": "aanvraag"`

## Vercel setup

1. Genereer secret: `openssl rand -base64 32`
2. Zet in Vercel → Environment Variables: `WEBHOOK_SECRET=...`
3. Deploy (webhook werkt pas op publieke URL, niet op localhost)

Lokaal testen kan met curl:

```bash
curl -X POST "http://localhost:3000/api/webhooks/forms?type=contact" \
  -H "Authorization: Bearer jouw-secret" \
  -H "Content-Type: application/json" \
  -d '{"naam":"Test","email":"test@voorbeeld.nl","bericht":"Hoi!"}'
```

## Avada per formulier

### Optie A — Hidden field (aanbevolen)

Voeg in elk Avada-formulier een **Hidden Field** toe:

| Formulier | Hidden field name | Value |
|-----------|-------------------|-------|
| Contact | `form_type` | `contact` |
| Aanvraag / offerte | `form_type` | `aanvraag` |
| Ontwerpdetails | `form_type` | `ontwerpdetails` |

Webhook-URL in Avada (Form Actions → Webhook, indien beschikbaar):

```
https://app.champagneisart.nl/api/webhooks/forms
```

Header: `Authorization: Bearer <WEBHOOK_SECRET>`

### Optie B — PHP in child theme (werkt altijd)

Plak in `functions.php` van je child theme:

```php
<?php
define('CIA_WEBHOOK_URL', 'https://app.champagneisart.nl/api/webhooks/forms');
define('CIA_WEBHOOK_SECRET', 'jouw-webhook-secret');

function cia_send_form_to_erp(array $payload, string $form_type) {
  $payload['form_type'] = $form_type;

  wp_remote_post(CIA_WEBHOOK_URL . '?type=' . rawurlencode($form_type), [
    'timeout' => 20,
    'headers' => [
      'Content-Type'  => 'application/json',
      'Authorization' => 'Bearer ' . CIA_WEBHOOK_SECRET,
    ],
    'body' => wp_json_encode($payload),
  ]);
}

// Pas form_id aan per Avada-formulier (te vinden in form editor URL)
add_action('fusion_form_submission', function ($args) {
  $form_id = $args['form_id'] ?? '';
  $data    = $args['data'] ?? [];

  $map = [
    '123' => 'contact',         // Contactformulier
    '456' => 'aanvraag',        // Offerte / aanvraag
    '789' => 'ontwerpdetails',  // Ontwerpdetails werkbon
  ];

  $type = $map[$form_id] ?? 'aanvraag';
  cia_send_form_to_erp($data, $type);
}, 10, 1);
```

> Form ID staat in de Avada form editor in de URL (`form_id=...`) of in de shortcode.

## Velden herkenning

De webhook mapt Nederlandse en Engelse veldnamen automatisch:

| ERP veld | Formuliervelden (voorbeelden) |
|----------|-------------------------------|
| Naam | `naam`, `name`, `volledige_naam` |
| E-mail | `email`, `e-mail`, `mail` |
| Telefoon | `telefoon`, `phone`, `tel` |
| Bericht | `bericht`, `message`, `toelichting` |
| Ordernummer | `order_number`, `ordernummer`, `bestelnummer` |
| Thema | `thema`, `theme` |
| Kleuren | `kleuren`, `kleurschema`, `color_scheme` |
| Tekst fles | `tekst`, `fles_tekst`, `bottle_text` |
| Voorkant | `voorkant`, `front_design` |
| Achterkant | `achterkant`, `back_design` |
| Stijl | `stijl`, `style` |
| Logo | `logo`, `logos`, `logo_notities` |

Onbekende velden worden opgeslagen in de aanvraagomschrijving / werkbon-notities.

## Ontwerpdetails — order koppelen

Het formulier zoekt een order in deze volgorde:

1. **Ordernummer** (`ordernummer` / `order_number`) — bijv. `CIA-2026-123456`
2. **E-mail** — meest recente order van die klant
3. Geen match → opslag bij aanvraag + **taak** “Ontwerpdetails — koppel aan order”

Tip: zet een hidden field of readonly veld met ordernummer in het ontwerpdetails-formulier (via link uit klantmail).

## Beveiliging

- Deel `WEBHOOK_SECRET` nooit in frontend JavaScript
- Alleen server-side (WordPress PHP of Avada webhook headers)
- Rotate secret als het gelekt is
