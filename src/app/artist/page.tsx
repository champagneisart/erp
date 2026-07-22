import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getArtistOrders, addArtistEvent } from "@/lib/actions/artist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function ArtistPortalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = Number(session.user.id);
  const artistOrders = await getArtistOrders(userId);

  return (
    <div className="min-h-screen bg-stone-100 p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-800">Kunstenaarsportaal</p>
          <h1 className="text-2xl font-semibold">Hallo, {session.user.name}</h1>
        </div>
        <form
          action={async () => {
            "use server";
            const { signOut } = await import("@/lib/auth");
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="outline">
            Uitloggen
          </Button>
        </form>
        <Link href="/account">
          <Button type="button" variant="outline">
            Mijn account
          </Button>
        </Link>
      </header>
      <div className="grid gap-4">
        {artistOrders.length === 0 && (
          <p className="text-stone-600">Geen orders toegewezen.</p>
        )}
        {artistOrders.map(({ order, product, workInstruction }) => (
          <Card key={order.id}>
            <CardHeader>
              <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
              {product && (
                <p className="text-sm font-medium text-stone-800">
                  {product.brand ? `${product.brand} — ` : ""}
                  {product.name}
                  {product.format ? ` (${product.format})` : ""} × {order.quantity}
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
                  <Button type="submit" variant="outline">
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
