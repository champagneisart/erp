import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, leads } from "@/db/schema";
import {
  convertLeadToOrder,
  updateLeadStatus,
} from "@/lib/actions/leads";
import {
  LEAD_STATUSES,
  canLeadTransition,
  type LeadStatus,
} from "@/lib/constants/statuses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const leadId = Number(id);
  const [row] = await db
    .select({ lead: leads, customer: customers })
    .from(leads)
    .leftJoin(customers, eq(leads.customerId, customers.id))
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!row) notFound();
  const { lead, customer } = row;
  const current = lead.status as LeadStatus;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Aanvraag #{lead.id} — {lead.title ?? "Zonder titel"}
      </h1>
      <Badge>{lead.status}</Badge>
      <Card>
        <CardContent className="pt-6 space-y-2 text-sm">
          <p>
            <strong>Klant:</strong> {customer?.name ?? "Niet gekoppeld"}
          </p>
          <p>
            <strong>Bron:</strong> {lead.source}
          </p>
          <p>{lead.description}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {LEAD_STATUSES.filter((s) => canLeadTransition(current, s)).map((s) => (
            <form
              key={s}
              action={async () => {
                "use server";
                await updateLeadStatus(leadId, s);
              }}
            >
              <Button type="submit" variant="outline">
                → {s}
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
      {lead.status === "approved" && lead.customerId && (
        <form
          action={async () => {
            "use server";
            const order = await convertLeadToOrder(leadId);
            redirect(`/orders/${order.id}`);
          }}
        >
          <Button type="submit">Omzetten naar order</Button>
        </form>
      )}
    </div>
  );
}
