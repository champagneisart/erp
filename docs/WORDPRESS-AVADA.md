# WordPress Avada → ERP webhooks

Alle gekoppelde Avada-formulieren sturen naar **één endpoint**. Formulier-ID en naam bepalen automatisch wat het ERP doet.

```
POST https://app.champagneisart.nl/api/webhooks/forms
Authorization: Bearer <WEBHOOK_SECRET>
Content-Type: application/json
```

## Jullie formulieren (mapping)

| Formulier | Form ID | ERP actie |
|-----------|---------|-----------|
| Contact us | 51 | Lead (contact) |
| Contact | 4257 | Lead (contact) |
| Custom Champagne * (zie lijst) | diverse | Lead (aanvraag) |
| Ontwerpdetails van bestelling | 465 | Werkbon op order |
| Haring Party 2024 | 52 | **Niet koppelen** |
| Champagne Sparta | 534 | **Niet koppelen** |
| Sollicitatie | 121 | **Niet koppelen** |
| Slijterij Champagne met kunst | 30 | **Niet koppelen** |
| Custom Champagne Horeca | 72 | **Niet koppelen** |

Custom Champagne formulieren (automatisch als **aanvraag** via naam):
- Zakengeschenk, Relatiegeschenk (86), Eindejaarsgeschenk, Dikke/Dikkere/Nog Dikkere Fles (228, 382), etc.

## Wat gebeurt er in het ERP

| Type | Resultaat |
|------|-----------|
| **contact** | Klant + lead (status *Nieuw*) + Inbox |
| **aanvraag** | Klant + lead (status *Nieuw*) + taak + Inbox |
| **ontwerpdetails** | Werkbon/richtlijn op order (of taak als order nog niet bestaat) |

Contact én aanvraag komen **beide in Aanvragen**. Irrelevante leads verplaats je naar status **Overig**.

Lead-flow:
1. **Nieuw** → indicatie/offerte → **Goedgekeurd**
2. **Omzetten naar order** → ordernummer `CIA-2026-…` + status *Order aangemaakt*

## Vercel setup

1. `WEBHOOK_SECRET` in Vercel (zelfde als lokaal)
2. Deploy — webhook werkt alleen op publieke URL

## PHP voor child theme (aanbevolen)

Eén hook voor **alle** formulieren — form ID + naam gaan mee, ERP beslist:

```php
<?php
define('CIA_WEBHOOK_URL', 'https://app.champagneisart.nl/api/webhooks/forms');
define('CIA_WEBHOOK_SECRET', 'jouw-webhook-secret');

add_action('fusion_form_submission', function ($args) {
  $form_id   = (string) ($args['form_id'] ?? '');
  $form_data = $args['data'] ?? [];
  $form_name = $args['form_name'] ?? $args['form_title'] ?? '';

  $payload = array_merge($form_data, [
    'form_id'   => $form_id,
    'form_name' => $form_name,
  ]);

  wp_remote_post(CIA_WEBHOOK_URL, [
    'timeout' => 20,
    'headers' => [
      'Content-Type'  => 'application/json',
      'Authorization' => 'Bearer ' . CIA_WEBHOOK_SECRET,
    ],
    'body' => wp_json_encode($payload),
  ]);
}, 10, 1);
```

Formulieren die **niet** gekoppeld moeten worden (Sparta, Sollicitatie, …) hoef je niet apart uit te zetten — het ERP negeert ze automatisch (`ignored: true`).

## Handmatig per formulier (Avada Webhook action)

URL: `https://app.champagneisart.nl/api/webhooks/forms`  
Header: `Authorization: Bearer <WEBHOOK_SECRET>`

Optioneel hidden field `form_type` alleen nodig als form ID/naam niet herkend wordt.

## Ontwerpdetails — order koppelen

Zoekt order op:
1. Veld `ordernummer` / `order_number`
2. Anders: meest recente order op e-mail

Tip: stuur klanten een link met ordernummer in het formulier.

## Velden

Automatisch herkend: `naam`, `email`, `telefoon`, `bericht`, `thema`, `kleuren`, `voorkant`, `achterkant`, `ordernummer`, …

Onbekende velden worden opgeslagen in de omschrijving.
