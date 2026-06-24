import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventory, products } from "@/db/schema";
import { createProduct, adjustInventory } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InventoryPage() {
  const rows = await db
    .select({ product: products, inv: inventory })
    .from(inventory)
    .innerJoin(products, eq(products.id, inventory.productId));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Voorraad</h1>
      <Card>
        <CardHeader>
          <CardTitle>Product toevoegen</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await createProduct({
                name: fd.get("name") as string,
                sku: (fd.get("sku") as string) || undefined,
                type: fd.get("type") as string,
                quantity: Number(fd.get("quantity") || 0),
                minimum: Number(fd.get("minimum") || 0),
              });
            }}
            className="grid max-w-md gap-3"
          >
            <Input name="name" placeholder="Naam" required />
            <Input name="sku" placeholder="SKU" />
            <select name="type" className="h-10 rounded-md border px-3 text-sm">
              <option value="standard_bottle">Standaardfles</option>
              <option value="magnum">Magnum</option>
              <option value="special">Speciaal</option>
              <option value="gift_box">Geschenkdoos</option>
              <option value="shipping">Verzendverpakking</option>
              <option value="material">Materiaal</option>
            </select>
            <Input name="quantity" type="number" placeholder="Aantal" defaultValue={0} />
            <Input name="minimum" type="number" placeholder="Minimum" defaultValue={0} />
            <Button type="submit">Toevoegen</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Voorraadlijst</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th>Product</th>
                <th>Voorraad</th>
                <th>Gereserveerd</th>
                <th>Vrij</th>
                <th>Min</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, inv }) => (
                <tr key={product.id} className="border-t">
                  <td className="py-2">{product.name}</td>
                  <td>{inv.quantity}</td>
                  <td>{inv.reserved}</td>
                  <td className={inv.quantity - inv.reserved <= inv.minimum ? "text-red-600 font-medium" : ""}>
                    {inv.quantity - inv.reserved}
                  </td>
                  <td>{inv.minimum}</td>
                  <td>
                    <form
                      action={async (fd) => {
                        "use server";
                        await adjustInventory(
                          product.id,
                          Number(fd.get("qty")),
                          "Handmatige correctie"
                        );
                      }}
                      className="flex gap-1"
                    >
                      <Input name="qty" type="number" defaultValue={inv.quantity} className="w-20" />
                      <Button type="submit" variant="outline">
                        Set
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
