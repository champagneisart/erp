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
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableScroll } from "@/components/ui/table-scroll";

function formatEuro(value: string | null) {
  if (!value) return "—";
  return `€ ${value}`;
}

function productLabel(p: {
  brand: string | null;
  name: string;
  format: string | null;
}) {
  return `${p.brand ? `${p.brand} — ` : ""}${p.name}${p.format ? ` (${p.format})` : ""}`;
}

export default async function InventoryPage() {
  const { products, rows, shipments, locations } = await getInventoryPageData();

  const office = locations.find((l) => l.slug === "office");
  const artistLocations = locations.filter((l) => l.locationType === "artist");

  const officeStock = rows.filter((r) => r.location.slug === "office");

  return (
    <div className="page-content space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Voorraad</h1>
        <p className="text-sm text-muted">
          Fles types, voorraad kantoor/kunstenaar, en wat er onderweg is
        </p>
      </div>

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
            className="form-stack md:grid-cols-3"
          >
            <Input name="name" placeholder="Naam (bijv. Ruinart BdB 0,75L)" required />
            <Input name="brand" placeholder="Merk (Ruinart, Moët…)" />
            <Select name="format">
              <option value="">Formaat</option>
              {BOTTLE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
            <Input name="purchasePriceExVat" placeholder="Inkoop excl. BTW (35.00)" />
            <Input name="sellPriceExVat" placeholder="Verkoop excl. BTW (214.88)" />
            <Input name="sellPriceIncVat" placeholder="Verkoop incl. BTW (260.00)" />
            <Button type="submit" className="md:col-span-3 sm:max-w-xs">
              Fles type toevoegen
            </Button>
          </form>

          <ul className="space-y-2 md:hidden">
            {products.map((p) => (
              <li key={p.id} className="mobile-card space-y-1 text-sm">
                <p className="font-medium">{p.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted">
                  {p.brand && <span>{p.brand}</span>}
                  {p.format && <span>{p.format}</span>}
                </div>
                <div className="flex justify-between pt-1 text-xs">
                  <span className="text-muted">Inkoop {formatEuro(p.purchasePriceExVat)}</span>
                  <span>Verkoop {formatEuro(p.sellPriceIncVat)}</span>
                </div>
              </li>
            ))}
            {products.length === 0 && (
              <li className="text-sm text-muted">Nog geen fles types</li>
            )}
          </ul>

          <TableScroll className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pr-4">Naam</th>
                  <th className="pr-4">Merk</th>
                  <th className="pr-4">Formaat</th>
                  <th className="pr-4">Inkoop</th>
                  <th>Verkoop incl.</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2 pr-4">{p.name}</td>
                    <td className="pr-4">{p.brand ?? "—"}</td>
                    <td className="pr-4">{p.format ?? "—"}</td>
                    <td className="pr-4">{formatEuro(p.purchasePriceExVat)}</td>
                    <td>{formatEuro(p.sellPriceIncVat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Kantoor</CardTitle>
            {office && (
              <Link
                href={`/inventory/log/${office.slug}`}
                className="shrink-0 text-xs text-muted hover:text-gold-bright"
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
                <li key={product.id} className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1">{productLabel(product)}</span>
                  <span className="shrink-0 font-medium">{inv.quantity}x</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {artistLocations.map((artistLoc) => {
          const stock = rows.filter((r) => r.location.id === artistLoc.id);
          return (
            <Card key={artistLoc.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>{artistLoc.name}</CardTitle>
                <Link
                  href={`/inventory/log/${artistLoc.slug}`}
                  className="shrink-0 text-xs text-muted hover:text-gold-bright"
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
                    <li key={product.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1">{productLabel(product)}</span>
                      <span className="shrink-0 font-medium">{inv.quantity}x</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
              className="form-stack sm:max-w-lg"
            >
              <Select name="productId" required>
                <option value="">Welke fles?</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {productLabel(p)}
                  </option>
                ))}
              </Select>
              <Select name="toLocationId" required>
                <option value="">Naar welke kunstenaar?</option>
                {artistLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
              <Input name="quantity" type="number" min={1} placeholder="Aantal" required />
              <Input name="note" placeholder="Notitie (optioneel)" />
              <Button type="submit">Verplaatsen</Button>
            </form>
          </CardContent>
        </Card>
      )}

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
              className="form-stack sm:max-w-lg"
            >
              <Select name="productId" required>
                <option value="">Welke fles?</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {productLabel(p)}
                  </option>
                ))}
              </Select>
              <Select name="locationId" required>
                <option value="">Waar?</option>
                <option value={office.id}>Kantoor</option>
                {artistLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
              <Input name="quantity" type="number" min={1} placeholder="Aantal" required />
              <Input name="note" placeholder="Notitie (optioneel)" />
              <Button type="submit">Bijboeken</Button>
            </form>
          </CardContent>
        </Card>
      )}

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
              className="form-stack md:grid-cols-2"
            >
              <Select name="productId" required>
                <option value="">Fles / merk / formaat</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {productLabel(p)}
                  </option>
                ))}
              </Select>
              <Input name="quantity" type="number" min={1} placeholder="Aantal" required />
              <Select name="destinationLocationId" required>
                <option value="">Bestemming</option>
                <option value={office.id}>Kantoor</option>
                {artistLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
              <Input name="supplierName" placeholder="Leverancier" />
              <Input name="orderReference" placeholder="Ordernummer webshop" />
              <Input name="trackingNumber" placeholder="Track & trace" />
              <Button type="submit" className="md:col-span-2 sm:max-w-xs">
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
                  className="flex flex-col gap-3 rounded-lg border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {productLabel(product)} × {shipment.quantityOrdered}
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
                    className="shrink-0"
                  >
                    <Button type="submit" variant="outline" className="w-full sm:w-auto">
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
