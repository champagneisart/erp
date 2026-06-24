import { notFound } from "next/navigation";
import { getPortalOrderByToken, portalApproveGuideline } from "@/lib/actions/portal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPortalOrderByToken(token);
  if (!data) notFound();

  const { order, customer, workInstruction, publicStatus } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100 p-6">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="text-center">
          <p className="text-sm uppercase tracking-wide text-amber-800">Champagne is Art</p>
          <h1 className="text-2xl font-semibold text-stone-900">Uw orderstatus</h1>
          <p className="text-stone-600">{order.orderNumber}</p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>{publicStatus}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Klant:</strong> {customer?.name}
            </p>
            <p>
              <strong>Thema:</strong> {order.theme ?? "—"}
            </p>
            <p>
              <strong>Verwachte datum:</strong> {formatDate(order.expectedReadyDate ?? order.deadline)}
            </p>
            <p>
              <strong>Factuur:</strong> {order.invoiceStatus}
            </p>
            {order.trackingNumber && (
              <p>
                <strong>Track & trace:</strong> {order.trackingNumber}
              </p>
            )}
          </CardContent>
        </Card>
        {workInstruction && (
          <Card>
            <CardHeader>
              <CardTitle>Ontwerprichtlijn</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>{workInstruction.theme}</p>
              <p>{workInstruction.colorScheme}</p>
              <p>{workInstruction.textContent}</p>
              {!order.guidelineApprovedAt && (
                <form
                  action={async () => {
                    "use server";
                    await portalApproveGuideline(token);
                  }}
                >
                  <Button type="submit" className="w-full">
                    Akkoord met richtlijn
                  </Button>
                </form>
              )}
              {order.guidelineApprovedAt && (
                <p className="text-green-700">Richtlijn goedgekeurd op {formatDate(order.guidelineApprovedAt)}</p>
              )}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-6 text-center text-sm text-stone-500">
            Vragen? Mail naar info@champagneisart.nl — upload via studio (MVP: handmatig door staff).
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
