import Link from "next/link";
import {
  addBottles,
  createProduct,
  getInventoryPageData,
  markShipmentReceived,
  registerIncomingShipment,
  transferStock,
} from "@/lib/actions/inventory";
import { BOTTLE_FORMATS } from "@/lib/constants/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatEuro(value: string | null) {
  if (!value) return "—";
  return `€ ${value}`;
}

export default async function InventoryPage() {
  const { products, rows, shipments, locations } = await getInventoryPageData();

  const office = locations.find((l) => l.slug === "office");
  const artistLocations = locations.filter((l) => l.locationType === "artist");

  const officeStock = rows.filter((r) => r.location.slug === "office");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Voorraad</h1>
        <p className="text-sm text-muted">
          Fles types, voorraad kantoor/kunstenaar, en wat er onderweg is
        </p>
      </div>

      {/* Fles types */}
      <Card>
        <CardHeader>
          <CardTitle>Fles types & prijzen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            action={async (fd) => {
              "use server";
              await createProduct({
                name: fd.get("name") as string,
                brand: (fd.get("brand") as string) || undefined,
                format: (fd.get("format") as string) || undefined,
                type: "standard_bottle",
                purchasePriceExVat: (fd.get("purchasePriceExVat") as string) || undefined,
                sellPriceExVat: (fd.get("sellPriceExVat") as string) || undefined,
                sellPriceIncVat: (fd.get("sellPriceIncVat") as string) || undefined,
              });
            }}
            className="grid gap-3 md:grid-cols-3"
          >
            <Input name="name" placeholder="Naam (bijv. Ruinart BdB 0,75L)" required />
            <Input name="brand" placeholder="Merk (Ruinart, Moët…)" />
            <select
              name="format"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">Formaat</option>
              {BOTTLE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <Input name="purchasePriceExVat" placeholder="Inkoop excl. BTW (35.00)" />
            <Input name="sellPriceExVat" placeholder="Verkoop excl. BTW (214.88)" />
            <Input name="sellPriceIncVat" placeholder="Verkoop incl. BTW (260.00)" />
            <Button type="submit" className="md:col-span-3 md:max-w-xs">
              Fles type toevoegen
            </Button>
          </form>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th>Naam</th>
                <th>Merk</th>
                <th>Formaat</th>
                <th>Inkoop</th>
                <th>Verkoop incl.</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">{p.name}</td>
                  <td>{p.brand ?? "—"}</td>
                  <td>{p.format ?? "—"}</td>
                  <td>{formatEuro(p.purchasePriceExVat)}</td>
                  <td>{formatEuro(p.sellPriceIncVat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Voorraad overzicht */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Kantoor</CardTitle>
            {office && (
              <Link
                href={`/inventory/log/${office.slug}`}
                className="text-xs text-muted hover:text-gold-bright"
              >
                Logboek →
              </Link>
            )}
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {officeStock.length === 0 && (
                <li className="text-muted">Nog geen voorraad</li>
              )}
              {officeStock.map(({ product, inv }) => (
                <li key={product.id} className="flex justify-between">
                  <span>
                    {product.brand ? `${product.brand} — ` : ""}
                    {product.name}
                  </span>
                  <span className="font-medium">{inv.quantity}x</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {artistLocations.map((artistLoc) => {
          const stock = rows.filter((r) => r.location.id === artistLoc.id);
          return (
            <Card key={artistLoc.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{artistLoc.name}</CardTitle>
                <Link
                  href={`/inventory/log/${artistLoc.slug}`}
                  className="text-xs text-muted hover:text-gold-bright"
                >
                  Logboek →
                </Link>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {stock.length === 0 && (
                    <li className="text-muted">Nog geen voorraad</li>
                  )}
                  {stock.map(({ product, inv }) => (
                    <li key={product.id} className="flex justify-between">
                      <span>
                        {product.brand ? `${product.brand} — ` : ""}
                        {product.name}
                      </span>
                      <span className="font-medium">{inv.quantity}x</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Transfer kantoor → kunstenaar */}
      {office && artistLocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Flessen brengen naar kunstenaar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted">
              Verplaats voorraad van kantoor naar kunstenaar. Wordt gelogd in beide logboeken.
            </p>
            <form
              action={async (fd) => {
                "use server";
                await transferStock({
                  productId: Number(fd.get("productId")),
                  fromLocationId: office!.id,
                  toLocationId: Number(fd.get("toLocationId")),
                  quantity: Number(fd.get("quantity")),
                  note: (fd.get("note") as string) || undefined,
                });
              }}
              className="grid max-w-lg gap-3"
            >
              <select
                name="productId"
                required
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Welke fles?</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand ? `${p.brand} — ` : ""}
                    {p.name} {p.format ? `(${p.format})` : ""}
                  </option>
                ))}
              </select>
              <select
                name="toLocationId"
                required
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Naar welke kunstenaar?</option>
                {artistLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <Input name="quantity" type="number" min={1} placeholder="Aantal" required />
              <Input name="note" placeholder="Notitie (optioneel)" />
              <Button type="submit">Verplaatsen</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Flessen bijboeken */}
      {office && artistLocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Flessen bijboeken</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted">
              Bijv. als je een doos naar de kunstenaar brengt, of nieuwe voorraad op kantoor zet.
            </p>
            <form
              action={async (fd) => {
                "use server";
                await addBottles({
                  productId: Number(fd.get("productId")),
                  locationId: Number(fd.get("locationId")),
                  quantity: Number(fd.get("quantity")),
                  note: (fd.get("note") as string) || undefined,
                });
              }}
              className="grid max-w-lg gap-3"
            >
              <select
                name="productId"
                required
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Welke fles?</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand ? `${p.brand} — ` : ""}
                    {p.name} {p.format ? `(${p.format})` : ""}
                  </option>
                ))}
              </select>
              <select
                name="locationId"
                required
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Waar?</option>
                <option value={office.id}>Kantoor</option>
                {artistLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <Input name="quantity" type="number" min={1} placeholder="Aantal" required />
              <Input name="note" placeholder="Notitie (optioneel)" />
              <Button type="submit">Bijboeken</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Onderweg */}
      <Card>
        <CardHeader>
          <CardTitle>Onderweg (besteld, nog niet ontvangen)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {office && artistLocations.length > 0 && (
            <form
              action={async (fd) => {
                "use server";
                await registerIncomingShipment({
                  productId: Number(fd.get("productId")),
                  quantity: Number(fd.get("quantity")),
                  destinationLocationId: Number(fd.get("destinationLocationId")),
                  supplierName: (fd.get("supplierName") as string) || undefined,
                  orderReference: (fd.get("orderReference") as string) || undefined,
                  trackingNumber: (fd.get("trackingNumber") as string) || undefined,
                });
              }}
              className="grid gap-3 md:grid-cols-2"
            >
              <select
                name="productId"
                required
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Fles / merk / formaat</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand ? `${p.brand} — ` : ""}
                    {p.name} {p.format ? `(${p.format})` : ""}
                  </option>
                ))}
              </select>
              <Input name="quantity" type="number" min={1} placeholder="Aantal" required />
              <select
                name="destinationLocationId"
                required
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Bestemming</option>
                <option value={office.id}>Kantoor</option>
                {artistLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <Input name="supplierName" placeholder="Leverancier" />
              <Input name="orderReference" placeholder="Ordernummer webshop" />
              <Input name="trackingNumber" placeholder="Track & trace" />
              <Button type="submit" className="md:col-span-2 md:max-w-xs">
                Onderweg registreren
              </Button>
            </form>
          )}

          {shipments.length === 0 ? (
            <p className="text-sm text-muted">Niets onderweg</p>
          ) : (
            <ul className="space-y-3">
              {shipments.map(({ shipment, product, location }) => (
                <li
                  key={shipment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {product.brand ? `${product.brand} — ` : ""}
                      {product.name} ({product.format ?? "?"}) × {shipment.quantityOrdered}
                    </p>
                    <p className="text-muted">
                      → {location.name}
                      {shipment.supplierName ? ` · ${shipment.supplierName}` : ""}
                      {shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ""}
                    </p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await markShipmentReceived(shipment.id);
                    }}
                  >
                    <Button type="submit" variant="outline">
                      Ontvangen
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
