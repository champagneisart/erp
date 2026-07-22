import { isFormType, type FormType } from "@/lib/webhooks/form-types";

export type NormalizedFormData = {
  formType: FormType;
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

const FIELD_ALIASES: Record<string, Exclude<keyof NormalizedFormData, "formType" | "extra" | "raw">> = {
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
  leverdatum: "deadline",
};

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
    extra: {},
    raw: flat,
  };

  const mappedKeys = new Set<string>();

  for (const [key, value] of Object.entries(flat)) {
    const alias = FIELD_ALIASES[key];
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

  for (const [key, value] of Object.entries(flat)) {
    if (mappedKeys.has(key) || key === "form_type" || key === "type") continue;
    if (key.startsWith("fusion_") || key === "form_id" || key === "post_id") continue;
    data.extra[key] = value;
  }

  if (!data.message && Object.keys(data.extra).length > 0) {
    data.message = Object.entries(data.extra)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
      .join("\n");
  }

  return data;
}
