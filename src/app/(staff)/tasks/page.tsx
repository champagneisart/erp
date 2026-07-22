import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@/db/schema";
import { createTask, updateTaskStatus } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function TasksPage() {
  const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));

  return (
    <div className="page-content space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Taken</h1>
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
            className="form-stack sm:max-w-lg"
          >
            <Input name="title" placeholder="Titel" required />
            <Input name="orderId" placeholder="Order ID (optioneel)" />
            <Textarea name="description" className="min-h-16" placeholder="Omschrijving" />
            <Select name="priority">
              <option value="low">Laag</option>
              <option value="medium">Normaal</option>
              <option value="high">Hoog</option>
            </Select>
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
            <div key={t.id} className="flex flex-col gap-3 border-b pb-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
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
                  <Button type="submit" variant="outline" className="w-full sm:w-auto">
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
