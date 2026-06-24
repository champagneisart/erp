import "dotenv/config";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema/index";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ontbreekt in .env.local");
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

async function main() {
  const hash = await bcrypt.hash("admin123", 10);

  await db.insert(schema.users).values({
    email: "admin@champagneisart.nl",
    passwordHash: hash,
    name: "Admin",
    role: "admin",
  });

  await db.insert(schema.users).values({
    email: "artist@champagneisart.nl",
    passwordHash: await bcrypt.hash("artist123", 10),
    name: "Studio Kunstenaar",
    role: "artist",
  });

  const [customer] = await db
    .insert(schema.customers)
    .values({
      name: "Demo Klant",
      company: "Demo BV",
      email: "klant@demo.nl",
      phone: "0612345678",
    })
    .returning();

  const [lead] = await db
    .insert(schema.leads)
    .values({
      customerId: customer.id,
      source: "manual",
      title: "Gepersonaliseerde magnum",
      status: "approved",
    })
    .returning();

  const [product] = await db
    .insert(schema.products)
    .values({ name: "Magnum standaard", type: "magnum", sku: "MAG-01" })
    .returning();

  await db.insert(schema.inventory).values({
    productId: product.id,
    quantity: 50,
    reserved: 0,
    minimum: 5,
  });

  const [order] = await db
    .insert(schema.orders)
    .values({
      orderNumber: "CIA-2026-000001",
      customerId: customer.id,
      leadId: lead.id,
      productId: product.id,
      quantity: 2,
      bottleFormat: "Magnum",
      theme: "Jubileum goud",
      status: "guideline_draft",
      artistUserId: 2,
      fulfillment: "pickup",
    })
    .returning();

  await db.insert(schema.workInstructions).values({
    orderId: order.id,
    theme: "Jubileum goud",
    colorScheme: "Goud / zwart",
    textContent: "50 jaar – familienaam",
  });

  await db.insert(schema.kbArticles).values({
    category: "tone_of_voice",
    title: "Tone of voice",
    content:
      "Warm, professioneel en creatief. Gebruik u-vorm. Kort en duidelijk.",
    tags: "email,whatsapp",
  });

  console.log("Seed klaar. Login: admin@champagneisart.nl / admin123");
}

main().catch(console.error);
