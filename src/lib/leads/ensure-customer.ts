import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, leads } from "@/db/schema";
import { normalizeFormPayload } from "@/lib/webhooks/parse-form-payload";

type CustomerFields = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
};

function extractCustomerFieldsFromLead(
  lead: typeof leads.$inferSelect
): CustomerFields {
  if (lead.rawPayload) {
    try {
      const flat = JSON.parse(lead.rawPayload) as Record<string, string>;
      const normalized = normalizeFormPayload(flat);
      return {
        name: normalized.name,
        email: normalized.email,
        phone: normalized.phone,
        company: normalized.company,
      };
    } catch {
      /* legacy plain text */
    }
  }
  return {};
}

export async function ensureCustomerForLead(
  lead: typeof leads.$inferSelect
): Promise<number> {
  if (lead.customerId) return lead.customerId;

  const fields = extractCustomerFieldsFromLead(lead);

  if (fields.email) {
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, fields.email))
      .limit(1);
    if (existing) {
      await db
        .update(leads)
        .set({ customerId: existing.id, updatedAt: new Date().toISOString() })
        .where(eq(leads.id, lead.id));
      return existing.id;
    }
  }

  const [created] = await db
    .insert(customers)
    .values({
      name: fields.name ?? "Onbekende klant",
      email: fields.email ?? null,
      phone: fields.phone ?? null,
      company: fields.company ?? null,
    })
    .returning();

  await db
    .update(leads)
    .set({ customerId: created.id, updatedAt: new Date().toISOString() })
    .where(eq(leads.id, lead.id));

  return created.id;
}
