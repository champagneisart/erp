import type { NormalizedFormData } from "@/lib/webhooks/parse-form-payload";
import { decodeArtistKeuze, formatArtistKeuze } from "@/lib/constants/artist-keuze";

/** Avada metadata — niet tonen in omschrijving */
export const FORM_METADATA_KEYS = new Set([
  "form_id",
  "form_name",
  "form_title",
  "form_naam",
  "post_id",
  "time",
  "source_url",
  "user_id",
  "user_agent",
  "ip",
  "is_read",
  "privacy_scrub_date",
  "on_privacy_scrub",
  "source",
  "fusion_form_id",
  "formid",
]);

/** Al op klantkaart — niet herhalen */
export const FORM_CUSTOMER_KEYS = new Set([
  "voornaam",
  "achternaam",
  "email",
  "e_mailadres",
  "mail",
  "telefoon",
  "phone",
  "bedrijfsnaam",
  "bedrijfsnaam_optioneel",
  "company",
]);

const FIELD_LABELS: Record<string, string> = {
  afleveradres: "Afleveradres",
  artist_keuze: "Kunstenaar & fles",
  artiest: "Kunstenaar & fles",
  straatnaam_huisnr: "Straat + huisnr.",
  postcode_plaats: "Postcode + plaats",
  factuuradres: "Factuuradres",
  elementen_voor_de_fles: "Elementen voor de fles",
  thema: "Thema",
  theme: "Thema",
  kleurstelling: "Kleuren",
  kleurschema: "Kleuren",
  voorkant: "Voorkant",
  achterkant: "Achterkant",
  aantal_flessen: "Aantal flessen",
  soort_fles: "Soort fles",
  leverdatum: "Leverdatum",
  levering: "Levering",
  opmerkingen: "Opmerkingen",
  bericht: "Bericht",
  tekstelementen: "Tekst",
  visuele_elementen: "Visuele elementen",
  andere_elementen: "Overige elementen",
  naam_van_de_bestelling: "Naam bestelling",
};

export function labelForField(key: string): string {
  return (
    FIELD_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function isRelevantFormField(key: string): boolean {
  if (FORM_METADATA_KEYS.has(key)) return false;
  if (FORM_CUSTOMER_KEYS.has(key)) return false;
  if (key.startsWith("fusion_")) return false;
  return true;
}

export type LeadDisplaySection = {
  title: string;
  items: { label: string; value: string }[];
};

export function buildLeadDescription(data: NormalizedFormData): string {
  const items: string[] = [];

  const add = (label: string, value?: string | number | null) => {
    const v = value === undefined || value === null ? "" : String(value).trim();
    if (v) items.push(`${label}: ${v}`);
  };

  add("Thema", data.theme);
  add("Aantal", data.quantity);
  add("Fles", data.style);
  add("Voorkant", data.frontDesign);
  add("Achterkant", data.backDesign);
  add("Kleuren", data.colorScheme);
  add("Tekst op fles", data.textContent);
  add("Afleveradres", data.extra.afleveradres);
  if (data.extra.artist_keuze) {
    add("Kunstenaar & fles", formatArtistKeuze(data.extra.artist_keuze));
  }
  add("Levering", data.subject);
  add("Leverdatum", data.deadline);
  add("Bericht", data.message);

  for (const [key, value] of Object.entries(data.extra)) {
    if (!isRelevantFormField(key)) continue;
    if (key === "afleveradres" || key === "artist_keuze" || key === "artiest") continue;
    if (!value.trim()) continue;
    add(labelForField(key), value);
  }

  return items.join("\n") || "Inzending via website";
}

export function parseLeadDisplaySections(
  rawPayload: string | null | undefined,
  description?: string | null
): LeadDisplaySection[] {
  let flat: Record<string, string> = {};
  if (rawPayload) {
    try {
      const parsed = JSON.parse(rawPayload) as Record<string, string>;
      if (parsed && typeof parsed === "object") flat = parsed;
    } catch {
      /* legacy plain text */
    }
  }

  const aanvraag: { label: string; value: string }[] = [];
  const adres: { label: string; value: string }[] = [];
  const overig: { label: string; value: string }[] = [];

  for (const [key, value] of Object.entries(flat)) {
    if (!isRelevantFormField(key) || !value.trim()) continue;

    if (key === "artist_keuze" || key === "artiest") {
      const decoded = decodeArtistKeuze(value);
      if (decoded) {
        aanvraag.push(
          { label: "Kunstenaar", value: decoded.artist },
          { label: "Fles", value: decoded.bottle },
          { label: "Prijs", value: decoded.priceLabel }
        );
      } else {
        aanvraag.push({ label: labelForField(key), value });
      }
      continue;
    }

    const item = { label: labelForField(key), value };
    if (
      key.includes("straat") ||
      key.includes("postcode") ||
      key.includes("aflever") ||
      key.includes("factuur")
    ) {
      adres.push(item);
    } else if (
      key.includes("artist") ||
      key.includes("fles") ||
      key.includes("element") ||
      key.includes("thema") ||
      key.includes("kleur") ||
      key.includes("voorkant") ||
      key.includes("achterkant") ||
      key.includes("lever") ||
      key.includes("aantal")
    ) {
      aanvraag.push(item);
    } else {
      overig.push(item);
    }
  }

  const sections: LeadDisplaySection[] = [];

  if (description && !description.includes("user agent") && description.length < 2000) {
    const cleanDesc = description
      .split("\n")
      .filter((line) => !line.toLowerCase().includes("user agent"))
      .filter((line) => !line.toLowerCase().includes("privacy scrub"))
      .join("\n")
      .trim();
    if (cleanDesc && aanvraag.length === 0 && overig.length === 0) {
      sections.push({ title: "Omschrijving", items: [{ label: "Bericht", value: cleanDesc }] });
    }
  }

  if (aanvraag.length > 0) sections.push({ title: "Aanvraag", items: aanvraag });
  if (adres.length > 0) sections.push({ title: "Adres", items: adres });
  if (overig.length > 0) sections.push({ title: "Overig", items: overig });

  if (sections.length === 0 && description) {
    sections.push({
      title: "Omschrijving",
      items: [{ label: "Bericht", value: description.slice(0, 1500) }],
    });
  }

  const sourceUrl = flat.source_url;
  if (sourceUrl) {
    sections.push({
      title: "Bron",
      items: [{ label: "Pagina", value: sourceUrl }],
    });
  }

  return sections;
}

export function formatAanvraagTitle(data: Pick<NormalizedFormData, "title" | "subject" | "formName" | "raw">): string {
  const sourceSlug = data.raw.source_url?.match(/gepersonaliseerde-champagne\/([^/?#]+)/)?.[1];
  if (sourceSlug) {
    return `Aanvraag: ${sourceSlug.replace(/-/g, " ")}`;
  }
  if (data.formName && !/form/i.test(data.formName)) {
    return data.formName;
  }
  return data.title ?? data.subject ?? "Nieuwe aanvraag via website";
}
