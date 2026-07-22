import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activityLog,
  customers,
  orders,
  products,
  statusPageTokens,
  users,
  workInstructions,
} from "@/db/schema";
import { checkArtistStock, getAllProducts } from "@/lib/actions/inventory";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const allProducts = await getAllProducts();
  const [selectedProduct] = order.productId
    ? await db.select().from(products).where(eq(products.id, order.productId)).limit(1)
    : [undefined];

  const stockCheck =
    order.productId && order.artistUserId
      ? await checkArtistStock(order.productId, order.artistUserId, order.quantity)
      : null;

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
    <div className="page-content space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{order.orderNumber}</h1>
        <Badge>{order.status}</Badge>
      </div>
      <p className="text-muted">
        Klant: {customer.name} — {order.theme}
      </p>

      {stockCheck && !stockCheck.ok && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          Voorraadtekort bij kunstenaar: {stockCheck.available} beschikbaar,{" "}
          {stockCheck.needed} nodig voor deze order. Er is automatisch een taak aangemaakt
          zodra je naar &quot;in_productie&quot; gaat.
        </div>
      )}

      {order.stockDeductedAt && (
        <p className="text-sm text-muted">
          Voorraad afgeboekt bij kunstenaar op {order.stockDeductedAt.slice(0, 10)}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fles & ordergegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              const productId = fd.get("productId") as string;
              await updateOrder(orderId, {
                productId: productId ? Number(productId) : null,
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
            className="form-stack sm:max-w-lg"
          >
            <label className="text-sm text-muted">Fles type</label>
            <Select name="productId" defaultValue={order.productId ?? ""}>
              <option value="">— Kies fles —</option>
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand ? `${p.brand} — ` : ""}
                  {p.name} {p.format ? `(${p.format})` : ""}
                  {p.sellPriceIncVat ? ` · €${p.sellPriceIncVat}` : ""}
                </option>
              ))}
            </Select>
            {selectedProduct && (
              <p className="text-xs text-muted">
                Inkoop: €{selectedProduct.purchasePriceExVat ?? "?"} excl. · Verkoop: €
                {selectedProduct.sellPriceIncVat ?? "?"} incl.
              </p>
            )}
            <Input name="theme" placeholder="Thema" defaultValue={order.theme ?? ""} />
            <Input name="bottleFormat" placeholder="Formaat (optioneel)" defaultValue={order.bottleFormat ?? selectedProduct?.format ?? ""} />
            <Input name="quantity" type="number" defaultValue={order.quantity} />
            <Input name="deadline" type="date" defaultValue={order.deadline?.slice(0, 10) ?? ""} />
            <Select name="fulfillment" defaultValue={order.fulfillment ?? ""}>
              <option value="">—</option>
              <option value="pickup">Afhalen</option>
              <option value="ship">Verzenden</option>
            </Select>
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
            className="form-stack"
          >
            <Input name="wi_theme" placeholder="Thema" defaultValue={wi?.theme ?? ""} />
            <Input name="colorScheme" placeholder="Kleuren" defaultValue={wi?.colorScheme ?? ""} />
            <Textarea
              name="textContent"
              defaultValue={wi?.textContent ?? ""}
              className="min-h-20"
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
            className="form-inline"
          >
            <Select name="artistUserId" defaultValue={order.artistUserId ?? ""} className="sm:flex-1">
              <option value="">Kies kunstenaar</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Button type="submit" className="sm:shrink-0">Toewijzen</Button>
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
