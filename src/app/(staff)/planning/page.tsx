import { asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, orders, users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default async function PlanningPage() {
  const rows = await db
    .select({
      order: orders,
      customer: customers,
      artist: users,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(users, eq(orders.artistUserId, users.id))
    .where(isNotNull(orders.artistUserId))
    .orderBy(asc(orders.deadline));

  const unassigned = await db
    .select({ order: orders, customer: customers })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(isNull(orders.artistUserId));

  return (
    <div className="page-content space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Planning</h1>
      <Card>
        <CardHeader>
          <CardTitle>Ingepland bij kunstenaar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map(({ order, customer, artist }) => (
            <div key={order.id} className="flex flex-col gap-1 border-b border-gold/10 pb-3 text-sm sm:flex-row sm:justify-between">
              <div className="min-w-0">
                <Link href={`/orders/${order.id}`} className="font-medium hover:underline">
                  {order.orderNumber}
                </Link>
                <p className="text-muted">
                  {customer.name} — {artist?.name}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p>{formatDate(order.deadline)}</p>
                <p className="text-muted">{order.status}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Nog niet toegewezen</CardTitle>
        </CardHeader>
        <CardContent>
          {unassigned.length === 0 && (
            <p className="text-sm text-muted">Alles toegewezen</p>
          )}
          {unassigned.map(({ order, customer }) => (
            <p key={order.id} className="text-sm">
              <Link href={`/orders/${order.id}`}>{order.orderNumber}</Link> — {customer.name}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
