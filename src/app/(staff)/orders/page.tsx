import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, orders } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableScroll } from "@/components/ui/table-scroll";

export default async function OrdersPage() {
  const rows = await db
    .select({ order: orders, customer: customers })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .orderBy(desc(orders.createdAt));

  return (
    <div className="page-content space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Orders</h1>
      <Card>
        <CardHeader>
          <CardTitle>Overzicht</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 md:hidden">
            {rows.map(({ order, customer }) => (
              <li key={order.id} className="mobile-card">
                <Link
                  href={`/orders/${order.id}`}
                  className="block space-y-1 text-sm hover:opacity-90"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{order.orderNumber}</span>
                    <Badge>{order.status}</Badge>
                  </div>
                  <p>{customer.name}</p>
                  {order.theme && <p className="text-muted">{order.theme}</p>}
                </Link>
              </li>
            ))}
          </ul>

          <TableScroll className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-2 pr-4">Nummer</th>
                  <th className="pb-2 pr-4">Klant</th>
                  <th className="pb-2 pr-4">Thema</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ order, customer }) => (
                  <tr key={order.id} className="border-t border-gold/10">
                    <td className="py-2 pr-4">
                      <Link href={`/orders/${order.id}`} className="font-medium hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="pr-4">{customer.name}</td>
                    <td className="pr-4">{order.theme ?? "—"}</td>
                    <td>
                      <Badge>{order.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </CardContent>
      </Card>
    </div>
  );
}
