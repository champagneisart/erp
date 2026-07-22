import { isFormType, type FormType } from "@/lib/webhooks/form-types";

/** Avada form IDs — uit WordPress Forms overzicht */
const IGNORED_FORM_IDS = new Set([
  "52", // Haring Party 2024
  "534", // Champagne Sparta
  "121", // Sollicitatie
  "30", // Slijterij Champagne met kunst
  "72", // Custom Champagne Horeca
]);

const CONTACT_FORM_IDS = new Set([
  "51", // Contact us
  "4257", // Contact
]);

const ONTWERP_FORM_IDS = new Set([
  "465", // Ontwerpdetails van bestelling
]);

const AANVRAAG_FORM_IDS = new Set([
  "86", // Relatiegeschenk
  "228", // Dikkere Fles
  "382", // Nog Dikkere Fles
]);

const IGNORED_NAME_PATTERNS = [
  /sollicitatie/i,
  /slijterij/i,
  /\bhoreca\b/i,
  /sparta/i,
  /haring party/i,
];

const CUSTOM_AANVRAAG_PATTERN = /custom champagne/i;

export function resolveAvadaFormType(
  formId?: string,
  formName?: string
): FormType | "ignore" | null {
  const id = formId?.trim();
  const name = formName?.trim();

  if (id && IGNORED_FORM_IDS.has(id)) return "ignore";
  if (name && IGNORED_NAME_PATTERNS.some((p) => p.test(name))) return "ignore";

  if (id && ONTWERP_FORM_IDS.has(id)) return "ontwerpdetails";
  if (id && CONTACT_FORM_IDS.has(id)) return "contact";
  if (id && AANVRAAG_FORM_IDS.has(id)) return "aanvraag";

  if (name) {
    if (/ontwerpdetails/i.test(name)) return "ontwerpdetails";
    if (/^contact(\s|$| us)/i.test(name)) return "contact";
    if (CUSTOM_AANVRAAG_PATTERN.test(name)) return "aanvraag";
  }

  return null;
}

export const AVADA_FORM_CATALOG = {
  contact: [...CONTACT_FORM_IDS],
  aanvraag: [...AANVRAAG_FORM_IDS],
  ontwerpdetails: [...ONTWERP_FORM_IDS],
  ignored: [...IGNORED_FORM_IDS],
} as const;
