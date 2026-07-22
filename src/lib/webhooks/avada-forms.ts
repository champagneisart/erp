import { isFormType, type FormType } from "@/lib/webhooks/form-types";

/** Bekende Avada form IDs (nieuwe IDs worden ook via URL/velden herkend) */
const IGNORED_FORM_IDS = new Set([
  "52",
  "534",
  "121",
  "30",
  "72",
]);

const CONTACT_FORM_IDS = new Set(["51", "4257", "3651"]);

const ONTWERP_FORM_IDS = new Set(["465", "5960"]);

const AANVRAAG_FORM_IDS = new Set([
  "86",
  "228",
  "382",
  // Overige pakketformulieren —zelfde structuur, ID via heuristiek
]);

const IGNORED_NAME_PATTERNS = [
  /sollicitatie/i,
  /slijterij/i,
  /\bhoreca\b/i,
  /sparta/i,
  /haring party/i,
];

const CONTACT_URL_PATTERNS = [/\/contact\/?$/i, /\/contact-us\/?$/i];
const ONTWERP_URL_PATTERNS = [/\/ontwerp\/?$/i];
const AANVRAAG_URL_PATTERNS = [
  /\/gepersonaliseerde-champagne\//i,
  /\/pakketten\/?$/i,
  /\/custom-champagne/i,
];

const AANVRAAG_NAME_PATTERNS = [
  /custom champagne/i,
  /dikkere fles/i,
  /dikke fles/i,
  /nog dikkere/i,
  /relatiegeschenk/i,
  /zakengeschenk/i,
  /eindejaars/i,
  /huiscollectie/i,
];

export type FormTypeResolution = {
  type: FormType | "ignore" | null;
  reason: string;
};

function flatHas(flat: Record<string, string>, ...needles: string[]): boolean {
  const keys = Object.keys(flat).join(" ").toLowerCase();
  const values = Object.values(flat).join(" ").toLowerCase();
  return needles.some((n) => keys.includes(n) || values.includes(n));
}

function matchSourceUrl(flat: Record<string, string>, patterns: RegExp[]): boolean {
  const url = flat.source_url ?? "";
  return patterns.some((p) => p.test(url));
}

function hasDesignFields(flat: Record<string, string>): boolean {
  return (
    flatHas(flat, "voorkant", "achterkant", "kleurstelling", "kleurschema") ||
    flatHas(flat, "visuele", "tekstelement", "soort_fles", "aantal_flessen")
  );
}

function hasContactShape(flat: Record<string, string>): boolean {
  return (
    flatHas(flat, "bericht", "voornaam", "email", "e_mail") &&
    !hasDesignFields(flat) &&
    !flatHas(flat, "artist", "aflever", "elementen_voor")
  );
}

function hasAanvraagShape(flat: Record<string, string>): boolean {
  return (
    flatHas(flat, "artist", "aflever", "factuur", "elementen", "aantal_flessen", "soort_fles") ||
    matchSourceUrl(flat, AANVRAAG_URL_PATTERNS)
  );
}

export function resolveAvadaFormTypeDetailed(
  formId?: string,
  formName?: string,
  flat: Record<string, string> = {}
): FormTypeResolution {
  const id = formId?.trim();
  const name = formName?.trim();

  if (id && IGNORED_FORM_IDS.has(id)) {
    return { type: "ignore", reason: `form_id ${id} staat op ignore-lijst` };
  }
  if (name && IGNORED_NAME_PATTERNS.some((p) => p.test(name))) {
    return { type: "ignore", reason: `form_name "${name}" matcht ignore-pattern` };
  }

  if (id && ONTWERP_FORM_IDS.has(id)) {
    return { type: "ontwerpdetails", reason: `form_id ${id}` };
  }
  if (id && CONTACT_FORM_IDS.has(id)) {
    return { type: "contact", reason: `form_id ${id}` };
  }
  if (id && AANVRAAG_FORM_IDS.has(id)) {
    return { type: "aanvraag", reason: `form_id ${id}` };
  }

  if (name) {
    if (/ontwerpdetails/i.test(name)) {
      return { type: "ontwerpdetails", reason: `form_name "${name}"` };
    }
    if (/^contact(\s|$| us)/i.test(name)) {
      return { type: "contact", reason: `form_name "${name}"` };
    }
    if (AANVRAAG_NAME_PATTERNS.some((p) => p.test(name))) {
      return { type: "aanvraag", reason: `form_name "${name}"` };
    }
  }

  if (matchSourceUrl(flat, ONTWERP_URL_PATTERNS) || (hasDesignFields(flat) && flatHas(flat, "naam_van_de_bestelling"))) {
    return { type: "ontwerpdetails", reason: "source_url /ontwerp/ of ontwerpvelden" };
  }

  if (matchSourceUrl(flat, CONTACT_URL_PATTERNS) || hasContactShape(flat)) {
    return { type: "contact", reason: "source_url /contact/ of contactvelden" };
  }

  if (matchSourceUrl(flat, AANVRAAG_URL_PATTERNS) || hasAanvraagShape(flat)) {
    return { type: "aanvraag", reason: "source_url pakketpagina of aanvraagvelden" };
  }

  if (hasDesignFields(flat)) {
    return { type: "ontwerpdetails", reason: "ontwerpvelden (voorkant/kleuren/…)" };
  }

  if (Object.keys(flat).length > 0) {
    return { type: "aanvraag", reason: "default — website-inzending zonder match" };
  }

  return { type: null, reason: "onvoldoende data" };
}

export function resolveAvadaFormType(
  formId?: string,
  formName?: string,
  flat: Record<string, string> = {}
): FormType | "ignore" | null {
  return resolveAvadaFormTypeDetailed(formId, formName, flat).type;
}

export const AVADA_FORM_CATALOG = {
  contact: [...CONTACT_FORM_IDS],
  aanvraag: [...AANVRAAG_FORM_IDS],
  ontwerpdetails: [...ONTWERP_FORM_IDS],
  ignored: [...IGNORED_FORM_IDS],
  heuristics: [
    "source_url (/contact/, /ontwerp/, /gepersonaliseerde-champagne/)",
    "veldnamen (voorkant, artist, bericht, …)",
  ],
} as const;
