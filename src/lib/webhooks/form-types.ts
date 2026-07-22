export const FORM_TYPES = ["contact", "aanvraag", "ontwerpdetails"] as const;
export type FormType = (typeof FORM_TYPES)[number];

export function isFormType(value: string): value is FormType {
  return (FORM_TYPES as readonly string[]).includes(value);
}
