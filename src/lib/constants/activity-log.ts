import {
  LEAD_STATUS_LABELS,
  ORDER_STATUSES,
  type LeadStatus,
  type OrderStatus,
} from "@/lib/constants/statuses";

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  status_change: "Status gewijzigd",
  created_from_lead: "Aangemaakt vanuit aanvraag",
  updated: "Gegevens bijgewerkt",
  artist_assigned: "Kunstenaar toegewezen",
  work_instruction_updated: "Werkbon bijgewerkt",
  status_link_created: "Klantstatuslink aangemaakt",
  guideline_approved: "Richtlijn goedgekeurd",
  created: "Aangemaakt",
  created_from_lead_conversion: "Klant aangemaakt bij conversie",
};

export function formatActivityAction(action: string): string {
  return ACTIVITY_ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export function formatActivityValue(
  action: string,
  value: string | null | undefined
): string {
  if (!value) return "—";
  if (action === "status_change") {
    const asLead = value as LeadStatus;
    if (LEAD_STATUS_LABELS[asLead]) return LEAD_STATUS_LABELS[asLead];
    const asOrder = value as OrderStatus;
    if (ORDER_STATUSES.includes(asOrder)) return asOrder.replace(/_/g, " ");
  }
  return value;
}
