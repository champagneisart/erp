import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, leads } from "@/db/schema";
import { createLead, createLeadFromIntakeText } from "@/lib/actions/leads";
import { LEAD_STATUSES } from "@/lib/constants/statuses";
import { PageHeader } from "@/components/layout/app-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function LeadsPage() {
  const rows = await db
    .select({ lead: leads, customer: customers })
    .from(leads)
    .leftJoin(customers, eq(leads.customerId, customers.id))
    .orderBy(desc(leads.createdAt));

  const allCustomers = await db.select().from(customers);

  return (
    <div className="page-content space-y-8">
      <PageHeader
        eyebrow="Bedrijfsmanagement web"
        title="Klantaanvragen"
        description="Overzicht van alle inkomende aanvragen. Plak mails voor AI-intake of maak handmatig een nieuwe aanvraag aan."
        actions={
          <span className="filter-pill text-gold-bright">
            {rows.length} aanvragen
          </span>
        }
      />

      <div className="flex flex-wrap gap-2">
        {["Alle", "Nieuw", "In behandeling", "Offerte", "Afgerond"].map((label) => (
          <span key={label} className="filter-pill">
            {label}
          </span>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map(({ lead, customer }) => (
          <Link key={lead.id} href={`/leads/${lead.id}`} className="group">
            <article className="app-card flex h-full flex-col p-4 transition group-hover:border-gold/50">
              <div className="mb-3 flex items-start justify-between gap-2">
                <Badge className="border-gold/20 bg-black/30 text-xs text-muted">
                  {lead.source}
                </Badge>
                <Badge>{lead.status}</Badge>
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {customer?.name ?? "Onbekende klant"}
              </h2>
              <p className="mt-1 text-sm text-gold-dim">
                {customer?.company ?? lead.title ?? "Geen titel"}
              </p>
              <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted">
                {lead.description ?? lead.title ?? "Geen omschrijving"}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-gold/10 pt-3 text-xs text-muted">
                <span className="rounded-full bg-white/5 px-2 py-1">#{lead.id}</span>
                <span>{formatDate(lead.createdAt)}</span>
              </div>
            </article>
          </Link>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="text-center text-sm text-muted">Nog geen aanvragen — maak er hieronder een aan.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nieuwe aanvraag</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (fd) => {
                "use server";
                const cid = fd.get("customerId") as string;
                await createLead({
                  customerId: cid ? Number(cid) : undefined,
                  source: "manual",
                  title: (fd.get("title") as string) || undefined,
                  description: (fd.get("description") as string) || undefined,
                });
              }}
              className="form-stack"
            >
              <Select name="customerId">
                <option value="">— Klant —</option>
                {allCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Input name="title" placeholder="Titel / thema" />
              <Textarea name="description" placeholder="Omschrijving" />
              <Button type="submit" className="rounded-full">
                Aanmaken
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI intake parser</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (fd) => {
                "use server";
                const rawText = (fd.get("rawText") as string) ?? "";
                if (!rawText.trim()) return;
                await createLeadFromIntakeText(rawText);
              }}
              className="form-stack"
            >
              <Textarea
                name="rawText"
                placeholder="Plak complete aanvraagtekst (mail, WhatsApp, formulier)."
                className="min-h-32"
                required
              />
              <Button type="submit" variant="secondary" className="rounded-full">
                AI extractie uitvoeren
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted">Statussen: {LEAD_STATUSES.join(", ")}</p>
    </div>
  );
}
