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
      </header>
      <div className="grid gap-4">
        {artistOrders.length === 0 && (
          <p className="text-stone-600">Geen orders toegewezen.</p>
        )}
        {artistOrders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
              <p className="text-sm text-stone-600">
                {order.theme} — deadline {formatDate(order.deadline)}
              </p>
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
