import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/db/schema";
import { createCustomer } from "@/lib/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CustomersPage() {
  const rows = await db.select().from(customers).orderBy(desc(customers.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Klanten</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nieuwe klant</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (fd) => {
                "use server";
                await createCustomer({
                  name: fd.get("name") as string,
                  company: (fd.get("company") as string) || undefined,
                  email: (fd.get("email") as string) || undefined,
                  phone: (fd.get("phone") as string) || undefined,
                });
              }}
              className="space-y-3"
            >
              <Input name="name" placeholder="Naam *" required />
              <Input name="company" placeholder="Bedrijf" />
              <Input name="email" type="email" placeholder="E-mail" />
              <Input name="phone" placeholder="Telefoon" />
              <Button type="submit">Opslaan</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alle klanten ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-stone-100">
              {rows.map((c) => (
                <li key={c.id} className="py-2">
                  <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-sm text-muted">{c.email ?? "—"}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
