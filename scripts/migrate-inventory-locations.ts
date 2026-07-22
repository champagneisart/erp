import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { and, eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema/index";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ontbreekt in .env.local");
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

async function ensureLocation(data: {
  slug: string;
  name: string;
  locationType: "office" | "artist";
  artistUserId?: number;
}) {
  const [existing] = await db
    .select()
    .from(schema.inventoryLocations)
    .where(eq(schema.inventoryLocations.slug, data.slug))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(schema.inventoryLocations)
    .values({
      slug: data.slug,
      name: data.name,
      locationType: data.locationType,
      artistUserId: data.artistUserId ?? null,
    })
    .returning();
  console.log(`Locatie aangemaakt: ${created.name}`);
  return created;
}

async function main() {
  const office = await ensureLocation({
    slug: "office",
    name: "Kantoor",
    locationType: "office",
  });

  const artists = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, "artist"));

  const artistLocations = [];
  for (const artist of artists) {
    if (artist.name !== "Darrin" && artist.email === "artist@champagneisart.nl") {
      await db
        .update(schema.users)
        .set({ name: "Darrin" })
        .where(eq(schema.users.id, artist.id));
      artist.name = "Darrin";
      console.log("Kunstenaar hernoemd naar Darrin");
    }

    const displayName =
      artist.name.toLowerCase() === "darrin"
        ? "Kunstenaar Darrin"
        : `Kunstenaar ${artist.name}`;

    const [existing] = await db
      .select()
      .from(schema.inventoryLocations)
      .where(eq(schema.inventoryLocations.artistUserId, artist.id))
      .limit(1);

    if (existing) {
      await db
        .update(schema.inventoryLocations)
        .set({ name: displayName })
        .where(eq(schema.inventoryLocations.id, existing.id));
      artistLocations.push({ ...existing, name: displayName });
      console.log(`Locatie bijgewerkt: ${displayName}`);
      continue;
    }

    const loc = await ensureLocation({
      slug: `artist-${artist.id}`,
      name: displayName,
      locationType: "artist",
      artistUserId: artist.id,
    });
    artistLocations.push(loc);
  }

  const products = await db.select().from(schema.products);
  const allLocations = [office, ...artistLocations];

  for (const product of products) {
    const existingRows = await db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.productId, product.id));

    const fallbackQty = existingRows[0]?.quantity ?? 0;
    const fallbackReserved = existingRows[0]?.reserved ?? 0;
    const fallbackMin = existingRows[0]?.minimum ?? 0;

    for (const loc of allLocations) {
      const hasRow = existingRows.some((r) => r.locationId === loc.id);
      if (hasRow) continue;

      await db.insert(schema.inventory).values({
        productId: product.id,
        locationId: loc.id,
        quantity: loc.id === office.id ? fallbackQty : 0,
        reserved: loc.id === office.id ? fallbackReserved : 0,
        minimum: fallbackMin,
      });
      console.log(`Voorraad: ${product.name} @ ${loc.name}`);
    }
  }

  console.log("Migratie voorraadlocaties klaar.");
}

main().catch(console.error);
