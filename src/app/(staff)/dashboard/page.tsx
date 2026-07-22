import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, orders, tasks } from "@/db/schema";
import { getLowStockProducts } from "@/lib/actions/inventory";
import { PageHeader } from "@/components/layout/app-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const openTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.status, "open"))
    .orderBy(desc(tasks.createdAt))
    .limit(8);

  const newLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.status, "new"))
    .limit(5);

  const activeOrders = await db
    .select()
    .from(orders)
    .where(sql`${orders.status} != 'completed'`)
    .orderBy(desc(orders.updatedAt))
    .limit(8);

  const lowStock = await getLowStockProducts();

  return (
    <div className="page-content space-y-8">
      <PageHeader
        eyebrow="Overzicht"
        title="Dashboard"
        description="Open taken, nieuwe aanvragen, orders en voorraad in één oogopslag."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Open taken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openTasks.length === 0 && (
              <p className="text-sm text-muted">Geen open taken</p>
            )}
            {openTasks.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-2 text-sm">
                <Link href="/tasks" className="min-w-0 flex-1 text-foreground hover:text-gold-bright">
                  {t.title}
                </Link>
                <Badge>{t.priority}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nieuwe aanvragen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {newLeads.map((l) => (
              <Link
                key={l.id}
                href={`/leads/${l.id}`}
                className="block text-sm text-foreground hover:text-gold-bright"
              >
                #{l.id} {l.title ?? "Zonder titel"}
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Lage voorraad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.length === 0 && (
              <p className="text-sm text-muted">Voorraad OK</p>
            )}
            {lowStock.map((row) => (
              <p key={`${row.location.id}-${row.product.id}`} className="text-sm text-foreground">
                {row.product.name} ({row.location.name}):{" "}
                {row.inv.quantity - row.inv.reserved} vrij
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders in behandeling</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {activeOrders.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-2 text-sm">
                <Link
                  href={`/orders/${o.id}`}
                  className="min-w-0 flex-1 font-medium text-foreground hover:text-gold-bright"
                >
                  {o.orderNumber}
                </Link>
                <span className="text-muted">{o.status}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
