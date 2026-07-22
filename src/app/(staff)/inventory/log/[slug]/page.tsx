import Link from "next/link";
import { notFound } from "next/navigation";
import { getCachedLocations } from "@/lib/cache/inventory";
import { getLocationLogbook } from "@/lib/actions/inventory";
import { MOVEMENT_TYPE_LABELS } from "@/lib/constants/inventory";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function describeMovement(
  movement: {
    movementType: string;
    quantity: number;
    locationId: number | null;
    locationFromId: number | null;
    locationToId: number | null;
    note: string | null;
  },
  viewingLocationId: number,
  fromName: string | null,
  toName: string | null
) {
  const label = MOVEMENT_TYPE_LABELS[movement.movementType] ?? movement.movementType;

  if (movement.movementType === "transfer") {
    if (movement.locationFromId === viewingLocationId) {
      return {
        sign: "-",
        text: `${label} naar ${toName ?? "andere locatie"} (${movement.quantity}x)`,
      };
    }
    if (movement.locationToId === viewingLocationId) {
      return {
        sign: "+",
        text: `${label} van ${fromName ?? "andere locatie"} (${movement.quantity}x)`,
      };
    }
  }

  if (movement.movementType === "consume") {
    return { sign: "-", text: `${label} (${movement.quantity}x)` };
  }

  return { sign: "+", text: `${label} (${movement.quantity}x)` };
}

export default async function InventoryLogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locations = await getCachedLocations();
  const location = locations.find((l) => l.slug === slug);
  if (!location) notFound();

  const entries = await getLocationLogbook(location.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            <Link href="/inventory" className="hover:text-gold-bright">
              ← Voorraad
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">Logboek: {location.name}</h1>
          <p className="text-sm text-muted">
            Alle bijboekingen, leveringen, verplaatsingen en afboekingen
          </p>
        </div>
        <Link href="/inventory">
          <Button variant="outline">Terug naar voorraad</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Geschiedenis</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted">Nog geen mutaties geregistreerd.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th>Datum & tijd</th>
                  <th>Product</th>
                  <th>Actie</th>
                  <th>Notitie</th>
                  <th>Door</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(({ movement, product, user, fromName, toName }) => {
                  const { sign, text } = describeMovement(
                    movement,
                    location.id,
                    fromName ?? null,
                    toName ?? null
                  );
                  return (
                    <tr key={movement.id} className="border-t border-border">
                      <td className="py-2 whitespace-nowrap">
                        {formatDateTime(movement.createdAt)}
                      </td>
                      <td>
                        {product.brand ? `${product.brand} — ` : ""}
                        {product.name}
                        {product.format ? ` (${product.format})` : ""}
                      </td>
                      <td className={sign === "-" ? "text-red-400" : "text-emerald-400"}>
                        {sign}
                        {text}
                      </td>
                      <td className="text-muted">{movement.note ?? "—"}</td>
                      <td className="text-muted">{user?.name ?? "Systeem"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
