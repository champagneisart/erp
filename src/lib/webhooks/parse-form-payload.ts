import { isFormType, type FormType } from "@/lib/webhooks/form-types";

export type NormalizedFormData = {
  formType: FormType;
  formId?: string;
  formName?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
  subject?: string;
  orderNumber?: string;
  title?: string;
  theme?: string;
  colorScheme?: string;
  textContent?: string;
  frontDesign?: string;
  backDesign?: string;
  style?: string;
  logosNotes?: string;
  visualElements?: string;
  attachmentsNotes?: string;
  quantity?: number;
  deadline?: string;
  extra: Record<string, string>;
  raw: Record<string, string>;
};

type MappableField = Exclude<
  keyof NormalizedFormData,
  "formType" | "formId" | "formName" | "extra" | "raw"
>;

const FIELD_ALIASES: Record<string, MappableField> = {
  naam: "name",
  name: "name",
  volledige_naam: "name",
  volledigenaam: "name",
  email: "email",
  e_mail: "email",
  mail: "email",
  telefoon: "phone",
  phone: "phone",
  tel: "phone",
  mobiel: "phone",
  bedrijf: "company",
  company: "company",
  organisatie: "company",
  bericht: "message",
  message: "message",
  opmerking: "message",
  vraag: "message",
  toelichting: "message",
  onderwerp: "subject",
  subject: "subject",
  order_number: "orderNumber",
  ordernummer: "orderNumber",
  order: "orderNumber",
  bestelnummer: "orderNumber",
  cia_nummer: "orderNumber",
  titel: "title",
  title: "title",
  aanvraag: "title",
  thema: "theme",
  theme: "theme",
  kleuren: "colorScheme",
  kleur: "colorScheme",
  color_scheme: "colorScheme",
  kleurschema: "colorScheme",
  tekst: "textContent",
  text: "textContent",
  fles_tekst: "textContent",
  bottle_text: "textContent",
  voorkant: "frontDesign",
  front: "frontDesign",
  front_design: "frontDesign",
  achterkant: "backDesign",
  back: "backDesign",
  back_design: "backDesign",
  stijl: "style",
  style: "style",
  logo: "logosNotes",
  logos: "logosNotes",
  logo_notities: "logosNotes",
  visueel: "visualElements",
  visual_elements: "visualElements",
  elementen: "visualElements",
  bijlagen: "attachmentsNotes",
  attachments: "attachmentsNotes",
  bestanden: "attachmentsNotes",
  upload: "attachmentsNotes",
  aantal: "quantity",
  quantity: "quantity",
  deadline: "deadline",
  bedrijfsnaam_optioneel: "company",
  bedrijfsnaam: "company",
  e_mailadres: "email",
  naam_van_de_bestelling: "title",
  onderwerp_of_thema_van_de_flesen: "theme",
  kleurstelling: "colorScheme",
  aantal_flessen: "quantity",
  soort_fles: "style",
  visuele_elementen: "visualElements",
  tekstelementen: "textContent",
  andere_elementen: "visualElements",
  opmerkingen: "message",
  levering: "subject",
  leverdatum: "deadline",
};

function combineNameParts(flat: Record<string, string>, data: NormalizedFormData) {
  if (data.name) return;
  const parts = [
    flat.voornaam,
    flat.first_name,
    flat.firstname,
    flat.achternaam,
    flat.last_name,
    flat.lastname,
  ].filter(Boolean);
  if (parts.length > 0) {
    data.name = [...new Set(parts)].join(" ").trim();
  }
}

function enrichCustomerFields(flat: Record<string, string>, data: NormalizedFormData) {
  combineNameParts(flat, data);

  if (!data.company && flat.bedrijfsnaam_optioneel) {
    data.company = flat.bedrijfsnaam_optioneel;
  }

  if (!data.title && flat.naam_van_de_bestelling) {
    data.title = flat.naam_van_de_bestelling;
  }

  if (!data.theme && flat.onderwerp_of_thema_van_de_flesen) {
    data.theme = flat.onderwerp_of_thema_van_de_flesen;
  }

  const shipping = [flat.straatnaam_huisnr, flat.postcode_plaats].filter(Boolean).join(", ");
  if (shipping) {
    data.extra.afleveradres = shipping;
  }

  for (const [key, value] of Object.entries(flat)) {
    if (!value) continue;
    const k = key.toLowerCase();
    if (k.includes("artist") || (k.includes("prijs") && k.includes("select"))) {
      data.extra.artist_keuze = value;
    }
  }
}

function resolveFieldAlias(key: string): MappableField | null {
  if (FIELD_ALIASES[key]) return FIELD_ALIASES[key];

  const k = key.toLowerCase();
  if (k.includes("email") || k.includes("e_mail") || k.endsWith("_mail")) return "email";
  if (k.includes("telefoon") || k.includes("phone") || k.includes("mobiel") || k.includes("tel"))
    return "phone";
  if (k.includes("bedrijf") || k.includes("company") || k.includes("organisatie")) return "company";
  if (k.includes("ordernummer") || k.includes("order_number") || k.includes("bestelnummer"))
    return "orderNumber";
  if (k.includes("voorkant") || k.includes("front")) return "frontDesign";
  if (k.includes("achterkant") || k.includes("back_design") || k === "back") return "backDesign";
  if (k.includes("kleur") || k.includes("color")) return "colorScheme";
  if (k.includes("thema") || k.includes("theme")) return "theme";
  if (k.includes("logo")) return "logosNotes";
  if (k === "naam" || k.includes("full_name") || k.includes("volledige") || k.endsWith("_name"))
    return "name";
  if (k.includes("bericht") || k.includes("message") || k.includes("opmerking") || k.includes("vraag"))
    return "message";
  if (k.includes("aantal") || k.includes("quantity")) return "quantity";
  if (k.includes("elementen") && k.includes("tekst")) return "textContent";
  if (k.includes("visueel")) return "visualElements";
  if (k.includes("leverdatum") || k.includes("deadline")) return "deadline";
  if (k.includes("levering") || k.includes("ophalen")) return "subject";

  return null;
}

function extractFormMeta(body: Record<string, unknown>, flat: Record<string, string>) {
  const formId =
    flat.form_id ??
    flat.fusion_form_id ??
    flat.formid ??
    (typeof body.form_id === "string" ? body.form_id : undefined) ??
    (typeof body.fusion_form_id === "number" ? String(body.fusion_form_id) : undefined);

  const formName =
    flat.form_name ??
    flat.form_title ??
    flat.form_naam ??
    (typeof body.form_name === "string" ? body.form_name : undefined) ??
    (typeof body.form_title === "string" ? body.form_title : undefined);

  return { formId, formName };
}

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/\[\]$/g, "")
    .replace(/^fusion-form-/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function flattenPayload(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};

  const out: Record<string, string> = {};

  function walk(obj: Record<string, unknown>, prefix = "") {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}_${key}` : key;
      if (value === null || value === undefined) continue;
      if (typeof value === "object" && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, fullKey);
        continue;
      }
      const str = Array.isArray(value) ? value.join(", ") : String(value).trim();
      if (str) out[normalizeKey(fullKey)] = str;
    }
  }

  walk(input as Record<string, unknown>);
  return out;
}

export async function parseRequestBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const fd = await request.formData();
    const out: Record<string, string> = {};
    for (const [key, value] of fd.entries()) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  }

  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

export function normalizeFormPayload(
  body: Record<string, unknown>,
  queryType?: string | null
): NormalizedFormData {
  const flat = flattenPayload(body);
  const meta = extractFormMeta(body, flat);

  const formTypeRaw =
    queryType ??
    flat.form_type ??
    flat.type ??
    (typeof body.form_type === "string" ? body.form_type : undefined) ??
    (typeof body.type === "string" ? body.type : undefined) ??
    "aanvraag";

  const formType = isFormType(formTypeRaw) ? formTypeRaw : "aanvraag";

  const data: NormalizedFormData = {
    formType,
    formId: meta.formId,
    formName: meta.formName,
    extra: {},
    raw: flat,
  };

  const mappedKeys = new Set<string>();

  for (const [key, value] of Object.entries(flat)) {
    const alias = resolveFieldAlias(key);
    if (!alias) {
      continue;
    }

    mappedKeys.add(key);

    if (alias === "quantity") {
      const n = Number(value);
      if (!Number.isNaN(n)) data.quantity = n;
      continue;
    }

    const field = alias as keyof NormalizedFormData;
    const current = data[field];
    if (typeof current === "string" && current) continue;

    (data as Record<string, unknown>)[alias] = value;
  }

  enrichCustomerFields(flat, data);

  for (const [key, value] of Object.entries(flat)) {
    if (mappedKeys.has(key) || key === "form_type" || key === "type") continue;
    if (
      key.startsWith("fusion_") ||
      key === "form_id" ||
      key === "form_name" ||
      key === "form_title" ||
      key === "post_id"
    )
      continue;
    data.extra[key] = value;
  }

  if (!data.message && Object.keys(data.extra).length > 0) {
    data.message = Object.entries(data.extra)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
      .join("\n");
  }

  return data;
}
