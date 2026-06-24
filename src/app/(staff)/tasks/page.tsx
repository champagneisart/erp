import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@/db/schema";
import { createTask, updateTaskStatus } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function TasksPage() {
  const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Taken</h1>
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe taak</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await createTask({
                title: fd.get("title") as string,
                description: (fd.get("description") as string) || undefined,
                priority: (fd.get("priority") as "low" | "medium" | "high") || "medium",
                orderId: fd.get("orderId") ? Number(fd.get("orderId")) : undefined,
              });
            }}
            className="grid max-w-lg gap-3"
          >
            <Input name="title" placeholder="Titel" required />
            <Input name="orderId" placeholder="Order ID (optioneel)" />
            <textarea
              name="description"
              className="min-h-16 rounded-md border p-2 text-sm"
              placeholder="Omschrijving"
            />
            <select name="priority" className="h-10 rounded-md border px-3 text-sm">
              <option value="low">Laag</option>
              <option value="medium">Normaal</option>
              <option value="high">Hoog</option>
            </select>
            <Button type="submit">Aanmaken</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Alle taken</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b pb-2 text-sm">
              <div>
                <p className="font-medium">{t.title}</p>
                <p className="text-muted">{t.description}</p>
                <Badge>{t.priority}</Badge> <Badge>{t.status}</Badge>
              </div>
              {t.status === "open" && (
                <form
                  action={async () => {
                    "use server";
                    await updateTaskStatus(t.id, "done");
                  }}
                >
                  <Button type="submit" variant="outline">
                    Afgerond
                  </Button>
                </form>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
