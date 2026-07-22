import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, leads, orders } from "@/db/schema";
import {
  convertLeadToOrder,
  updateLeadStatus,
} from "@/lib/actions/leads";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
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

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.leadId, leadId))
    .limit(1);

  return (
    <div className="page-content space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">
        Aanvraag #{lead.id} — {lead.title ?? "Zonder titel"}
      </h1>
      <Badge>{LEAD_STATUS_LABELS[current] ?? current}</Badge>

      {order && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <p>
              <strong>Ordernummer:</strong>{" "}
              <Link href={`/orders/${order.id}`} className="text-gold-bright hover:underline">
                {order.orderNumber}
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-2 pt-6 text-sm">
          <p>
            <strong>Klant:</strong>{" "}
            {customer ? (
              <Link href={`/customers/${customer.id}`} className="hover:text-gold-bright">
                {customer.name}
              </Link>
            ) : (
              "Niet gekoppeld"
            )}
          </p>
          {customer?.email && (
            <p>
              <strong>E-mail:</strong> {customer.email}
            </p>
          )}
          {customer?.phone && (
            <p>
              <strong>Telefoon:</strong> {customer.phone}
            </p>
          )}
          <p>
            <strong>Bron:</strong> {lead.source}
          </p>
          <p className="whitespace-pre-wrap">{lead.description}</p>
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
              <Button type="submit" variant="outline" className="text-xs sm:text-sm">
                → {LEAD_STATUS_LABELS[s]}
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>

      {lead.status === "approved" && lead.customerId && !order && (
        <form
          action={async () => {
            "use server";
            const created = await convertLeadToOrder(leadId);
            redirect(`/orders/${created.id}`);
          }}
        >
          <Button type="submit">Omzetten naar order (ordernummer aanmaken)</Button>
        </form>
      )}
    </div>
  );
}
