export const SHIPMENT_STATUSES = ["in_transit", "received", "cancelled"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  in_transit: "Onderweg",
  received: "Ontvangen",
  cancelled: "Geannuleerd",
};

export const BOTTLE_FORMATS = ["0,75L", "1,5L", "3L", "6-15L"] as const;
