export const LEAD_STATUSES = [
  "new",
  "missing_info",
  "quote_sent",
  "offer_sent",
  "approved",
  "converted",
  "cancelled",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const ORDER_STATUSES = [
  "awaiting_customer_info",
  "input_complete",
  "guideline_draft",
  "awaiting_approval",
  "scheduled",
  "in_production",
  "finishing",
  "qc",
  "ready_pickup_ship",
  "completed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const INVOICE_STATUSES = [
  "not_sent",
  "sent",
  "paid",
  "overdue",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["missing_info", "quote_sent", "cancelled"],
  missing_info: ["quote_sent", "offer_sent", "cancelled"],
  quote_sent: ["offer_sent", "missing_info", "cancelled"],
  offer_sent: ["approved", "missing_info", "cancelled"],
  approved: ["converted", "cancelled"],
  converted: [],
  cancelled: [],
};

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  awaiting_customer_info: ["input_complete"],
  input_complete: ["guideline_draft", "awaiting_customer_info"],
  guideline_draft: ["awaiting_approval", "input_complete"],
  awaiting_approval: ["scheduled", "guideline_draft"],
  scheduled: ["in_production", "awaiting_approval"],
  in_production: ["finishing", "scheduled"],
  finishing: ["qc", "in_production"],
  qc: ["ready_pickup_ship", "finishing"],
  ready_pickup_ship: ["completed", "qc"],
  completed: [],
};

export const PUBLIC_STATUS_LABELS: Record<string, string> = {
  awaiting_customer_info: "Aanvraag ontvangen",
  input_complete: "Ontwerpgegevens compleet",
  guideline_draft: "In behandeling",
  awaiting_approval: "In behandeling",
  scheduled: "In behandeling",
  in_production: "Bij kunstenaar",
  finishing: "Afwerking / controle",
  qc: "Afwerking / controle",
  ready_pickup_ship: "Klaar voor ophalen of verzending",
  completed: "Afgerond",
};

export function canLeadTransition(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canOrderTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getPublicStatusLabel(status: string): string {
  return PUBLIC_STATUS_LABELS[status] ?? status;
}
