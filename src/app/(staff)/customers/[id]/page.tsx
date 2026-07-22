import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, customerFiles, leads, orders } from "@/db/schema";
import { updateCustomer } from "@/lib/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customerId = Number(id);
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) notFound();

  const files = await db
    .select()
    .from(customerFiles)
    .where(eq(customerFiles.customerId, customerId));
  const customerLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.customerId, customerId));
  const customerOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId));

  return (
    <div className="page-content space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">{customer.name}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await updateCustomer(customerId, {
                name: fd.get("name") as string,
                company: (fd.get("company") as string) || undefined,
                email: (fd.get("email") as string) || undefined,
                phone: (fd.get("phone") as string) || undefined,
                notes: (fd.get("notes") as string) || undefined,
              });
            }}
            className="form-stack sm:max-w-lg"
          >
            <Input name="name" defaultValue={customer.name} required />
            <Input name="company" defaultValue={customer.company ?? ""} />
            <Input name="email" defaultValue={customer.email ?? ""} />
            <Input name="phone" defaultValue={customer.phone ?? ""} />
            <Textarea name="notes" defaultValue={customer.notes ?? ""} className="min-h-24" />
            <Button type="submit">Bijwerken</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aanvragen</CardTitle>
          </CardHeader>
          <CardContent>
            {customerLeads.map((l) => (
              <p key={l.id} className="text-sm">
                #{l.id} — {l.status}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {customerOrders.map((o) => (
              <p key={o.id} className="text-sm">
                {o.orderNumber} — {o.status}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bestanden</CardTitle>
          </CardHeader>
          <CardContent>
            {files.map((f) => (
              <a key={f.id} href={f.blobUrl} className="block text-sm text-gold">
                {f.fileName}
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
