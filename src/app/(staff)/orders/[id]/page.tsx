import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activityLog,
  customers,
  orders,
  statusPageTokens,
  users,
  workInstructions,
} from "@/db/schema";
import {
  assignArtist,
  generateStatusLink,
  pushWorkbonToExternalApp,
  updateOrder,
  updateOrderStatus,
  upsertWorkInstruction,
} from "@/lib/actions/orders";
import {
  ORDER_STATUSES,
  canOrderTransition,
  type OrderStatus,
} from "@/lib/constants/statuses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  const [row] = await db
    .select({ order: orders, customer: customers })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) notFound();
  const { order, customer } = row;

  const [wi] = await db
    .select()
    .from(workInstructions)
    .where(eq(workInstructions.orderId, orderId))
    .limit(1);

  const artists = await db.select().from(users).where(eq(users.role, "artist"));
  const tokens = await db
    .select()
    .from(statusPageTokens)
    .where(eq(statusPageTokens.orderId, orderId));
  const logs = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.entityId, orderId));

  const current = order.status as OrderStatus;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{order.orderNumber}</h1>
        <Badge>{order.status}</Badge>
      </div>
      <p className="text-muted">
        Klant: {customer.name} — {order.theme}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Ordergegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await updateOrder(orderId, {
                theme: (fd.get("theme") as string) || undefined,
                bottleFormat: (fd.get("bottleFormat") as string) || undefined,
                quantity: Number(fd.get("quantity")),
                deadline: (fd.get("deadline") as string) || undefined,
                fulfillment:
                  fd.get("fulfillment") === "pickup" || fd.get("fulfillment") === "ship"
                    ? (fd.get("fulfillment") as "pickup" | "ship")
                    : undefined,
              });
            }}
            className="grid max-w-lg gap-3"
          >
            <Input name="theme" defaultValue={order.theme ?? ""} />
            <Input name="bottleFormat" defaultValue={order.bottleFormat ?? ""} />
            <Input name="quantity" type="number" defaultValue={order.quantity} />
            <Input name="deadline" type="date" defaultValue={order.deadline?.slice(0, 10) ?? ""} />
            <select
              name="fulfillment"
              defaultValue={order.fulfillment ?? ""}
              className="h-10 rounded-md border border-gold/25 px-3 text-sm"
            >
              <option value="">—</option>
              <option value="pickup">Afhalen</option>
              <option value="ship">Verzenden</option>
            </select>
            <Button type="submit">Opslaan</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ORDER_STATUSES.filter((s) => canOrderTransition(current, s)).map((s) => (
            <form
              key={s}
              action={async () => {
                "use server";
                await updateOrderStatus(orderId, s);
              }}
            >
              <Button type="submit" variant="outline">
                → {s}
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Werkbon / richtlijn</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await upsertWorkInstruction(orderId, {
                theme: fd.get("wi_theme") as string,
                colorScheme: fd.get("colorScheme") as string,
                textContent: fd.get("textContent") as string,
                frontDesign: fd.get("frontDesign") as string,
                backDesign: fd.get("backDesign") as string,
                style: fd.get("style") as string,
              });
            }}
            className="grid gap-3"
          >
            <Input name="wi_theme" placeholder="Thema" defaultValue={wi?.theme ?? ""} />
            <Input name="colorScheme" placeholder="Kleuren" defaultValue={wi?.colorScheme ?? ""} />
            <textarea
              name="textContent"
              defaultValue={wi?.textContent ?? ""}
              className="min-h-20 rounded-md border p-2 text-sm"
              placeholder="Tekst"
            />
            <Input name="frontDesign" placeholder="Voorkant" defaultValue={wi?.frontDesign ?? ""} />
            <Input name="backDesign" placeholder="Achterkant" defaultValue={wi?.backDesign ?? ""} />
            <Input name="style" placeholder="Stijl" defaultValue={wi?.style ?? ""} />
            <Button type="submit">Richtlijn opslaan</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kunstenaar & klantlink</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (fd) => {
              "use server";
              const uid = fd.get("artistUserId") as string;
              if (uid) await assignArtist(orderId, Number(uid));
            }}
            className="flex gap-2"
          >
            <select name="artistUserId" className="h-10 flex-1 rounded-md border px-3 text-sm">
              <option value="">Kies kunstenaar</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id} selected={order.artistUserId === a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <Button type="submit">Toewijzen</Button>
          </form>
          <form
            action={async () => {
              "use server";
              await generateStatusLink(orderId);
            }}
          >
            <Button type="submit" variant="secondary">
              Nieuwe klantstatuslink
            </Button>
          </form>
          {tokens.map((t) => (
            <p key={t.id} className="text-sm break-all">
              Token: /portal/{t.token}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Werkbon integratie</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await pushWorkbonToExternalApp(orderId);
            }}
          >
            <Button type="submit" variant="secondary">
              Stuur werkbon naar externe app
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activiteit</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.map((l) => (
            <p key={l.id} className="text-xs text-muted">
              {l.createdAt}: {l.action} {l.fromValue} → {l.toValue}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
