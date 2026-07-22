import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, leads, orders } from "@/db/schema";
import {
  convertLeadToOrder,
  deleteLead,
  updateLead,
  updateLeadStatus,
} from "@/lib/actions/leads";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  canLeadTransition,
  type LeadStatus,
} from "@/lib/constants/statuses";
import { parseLeadDisplaySections } from "@/lib/webhooks/form-display";
import { getLeadMailDraft } from "@/lib/ai/inbox-draft";
import { MailDraftPanel } from "@/components/inbox/mail-draft-panel";
import { LeadEditSection } from "@/components/leads/lead-edit-form";
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

  const sections = parseLeadDisplaySections(lead.rawPayload, lead.description);
  const mailDraft = await getLeadMailDraft(leadId);

  async function saveLead(formData: FormData) {
    "use server";
    await updateLead(leadId, {
      title: (formData.get("title") as string) || undefined,
      description: (formData.get("description") as string) || undefined,
      customerName: (formData.get("customerName") as string) || undefined,
      customerEmail: (formData.get("customerEmail") as string) || undefined,
      customerPhone: (formData.get("customerPhone") as string) || undefined,
      customerCompany: (formData.get("customerCompany") as string) || undefined,
    });
  }

  return (
    <div className="page-content space-y-6">
      <p className="text-sm text-muted">
        <Link href="/leads" className="hover:text-gold-bright">
          ← Alle aanvragen
        </Link>
      </p>

      <LeadEditSection
        title={lead.title ?? ""}
        description={lead.description ?? ""}
        customerName={customer?.name ?? ""}
        customerEmail={customer?.email ?? ""}
        customerPhone={customer?.phone ?? ""}
        customerCompany={customer?.company ?? ""}
        onSave={saveLead}
      >
        <div className="space-y-2">
          <h1 className="text-xl font-semibold sm:text-2xl">
            Aanvraag #{lead.id}
          </h1>
          <p className="text-lg text-gold-dim">{lead.title ?? "Zonder titel"}</p>
          <Badge>{LEAD_STATUS_LABELS[current] ?? current}</Badge>
        </div>
      </LeadEditSection>

      {order ? (
        <Card>
          <CardHeader>
            <CardTitle>Order</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              Deze aanvraag is omgezet naar order{" "}
              <Link href={`/orders/${order.id}`} className="font-medium text-gold-bright hover:underline">
                {order.orderNumber}
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : !["cancelled", "converted"].includes(lead.status) ? (
        <Card>
          <CardHeader>
            <CardTitle>Order aanmaken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted">
              Maak een order aan op basis van deze aanvraag. De klant wordt automatisch
              aangemaakt of gekoppeld als dat nog niet is gebeurd.
            </p>
            <form
              action={async () => {
                "use server";
                const created = await convertLeadToOrder(leadId);
                redirect(`/orders/${created.id}`);
              }}
            >
              <Button type="submit">Omzetten naar order</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {mailDraft?.draft && (
        <Card>
          <CardHeader>
            <CardTitle>Antwoord aan klant</CardTitle>
          </CardHeader>
          <CardContent>
            <MailDraftPanel
              emailBody={mailDraft.draft.body}
              internalNotes={mailDraft.draft.internalNotes}
              approved={mailDraft.draft.approved}
              draftId={mailDraft.draft.id}
              leadId={leadId}
              regenerateContext={{
                customerName: customer?.name ?? undefined,
                customerEmail: customer?.email ?? undefined,
                leadTitle: lead.title ?? undefined,
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Klant</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted">Naam</span>
            <br />
            {customer ? (
              <Link href={`/customers/${customer.id}`} className="font-medium hover:text-gold-bright">
                {customer.name}
              </Link>
            ) : (
              "Niet gekoppeld"
            )}
          </p>
          {customer?.email && (
            <p>
              <span className="text-muted">E-mail</span>
              <br />
              <a href={`mailto:${customer.email}`} className="font-medium hover:text-gold-bright">
                {customer.email}
              </a>
            </p>
          )}
          {customer?.phone && (
            <p>
              <span className="text-muted">Telefoon</span>
              <br />
              <a href={`tel:${customer.phone}`} className="font-medium hover:text-gold-bright">
                {customer.phone}
              </a>
            </p>
          )}
          {customer?.company && (
            <p>
              <span className="text-muted">Bedrijf</span>
              <br />
              <span className="font-medium">{customer.company}</span>
            </p>
          )}
          <p>
            <span className="text-muted">Bron</span>
            <br />
            <span className="font-medium capitalize">{lead.source}</span>
          </p>
        </CardContent>
      </Card>

      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {section.items.map((item) => (
                <div key={`${section.title}-${item.label}`} className="min-w-0">
                  <dt className="text-muted">{item.label}</dt>
                  <dd className="mt-0.5 font-medium break-words whitespace-pre-wrap">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}

      {lead.rawPayload && (
        <details className="rounded-lg border border-border bg-background/30 p-4 text-sm">
          <summary className="cursor-pointer text-muted hover:text-foreground">
            Ruwe formulierdata (technisch)
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-muted">
            {lead.rawPayload}
          </pre>
        </details>
      )}

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

      {!order && (
        <Card>
          <CardHeader>
            <CardTitle>Verwijderen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted">
              Verwijder deze aanvraag permanent. Niet mogelijk als er al een order is.
            </p>
            <form
              action={async () => {
                "use server";
                await deleteLead(leadId);
              }}
            >
              <Button type="submit" variant="outline" className="text-red-400">
                Aanvraag verwijderen
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
