import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getArtistOrders, getArtistStockView, addArtistEvent } from "@/lib/actions/artist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

function productLabel(p: {
  brand: string | null;
  name: string;
  format: string | null;
}) {
  return `${p.brand ? `${p.brand} — ` : ""}${p.name}${p.format ? ` (${p.format})` : ""}`;
}

export default async function ArtistPortalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = Number(session.user.id);

  const [artistOrders, stock] = await Promise.all([
    getArtistOrders(userId),
    getArtistStockView(userId),
  ]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-stone-100 p-4 sm:p-6">
      <header className="mb-5 flex items-start justify-between gap-3 sm:mb-8">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-amber-800">Kunstenaarsportaal</p>
          <h1 className="truncate text-lg font-semibold sm:text-2xl">Hallo, {session.user.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <Link href="/account">
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2.5 text-xs text-stone-600 hover:text-stone-900 sm:h-9 sm:px-3 sm:text-sm"
            >
              Account
            </Button>
          </Link>
          <form
            action={async () => {
              "use server";
              const { signOut } = await import("@/lib/auth");
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              className="h-8 px-2.5 text-xs text-stone-600 hover:text-stone-900 sm:h-9 sm:px-3 sm:text-sm"
            >
              Uitloggen
            </Button>
          </form>
        </div>
      </header>

      <div className="page-content grid gap-4">
        {stock.location && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Jouw voorraad</CardTitle>
              <p className="text-sm text-stone-600">{stock.location.name}</p>
            </CardHeader>
            <CardContent>
              {stock.items.length === 0 ? (
                <p className="text-sm text-stone-600">Nog geen flessen op voorraad.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {stock.items.map(({ product, inv }) => (
                    <li key={product.id} className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1">{productLabel(product)}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{inv.quantity}x</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {artistOrders.length === 0 && (
          <p className="text-stone-600">Geen orders toegewezen.</p>
        )}
        {artistOrders.map(({ order, product, workInstruction }) => (
          <Card key={order.id}>
            <CardHeader>
              <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
              {product && (
                <p className="text-sm font-medium text-stone-800">
                  {productLabel(product)} × {order.quantity}
                </p>
              )}
              <p className="text-sm text-stone-600">
                {order.theme ?? workInstruction?.theme ?? "Geen thema"} — deadline{" "}
                {formatDate(order.deadline)}
              </p>
              {workInstruction && (
                <div className="mt-2 rounded-md bg-stone-50 p-3 text-sm text-stone-700">
                  <p className="font-medium">Werkbon</p>
                  {workInstruction.colorScheme && (
                    <p>Kleuren: {workInstruction.colorScheme}</p>
                  )}
                  {workInstruction.textContent && (
                    <p>Tekst: {workInstruction.textContent}</p>
                  )}
                  {workInstruction.frontDesign && (
                    <p>Voorkant: {workInstruction.frontDesign}</p>
                  )}
                </div>
              )}
              <Badge>{order.status}</Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(
                [
                  ["viewed", "Bekeken"],
                  ["started", "Gestart"],
                  ["ready_for_review", "Klaar voor controle"],
                  ["question", "Vraag stellen"],
                ] as const
              ).map(([type, label]) => (
                <form
                  key={type}
                  action={async () => {
                    "use server";
                    await addArtistEvent(order.id, type);
                  }}
                >
                  <Button type="submit" variant="outline" className="px-3 py-1.5 text-xs sm:text-sm">
                    {label}
                  </Button>
                </form>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
