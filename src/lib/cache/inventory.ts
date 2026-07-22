import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { inventoryLocations, products } from "@/db/schema";

export const getCachedLocations = unstable_cache(
  async () => db.select().from(inventoryLocations),
  ["inventory-locations"],
  { revalidate: 120, tags: ["inventory-locations"] }
);

export const getCachedProducts = unstable_cache(
  async () => db.select().from(products).orderBy(products.brand, products.name),
  ["inventory-products"],
  { revalidate: 60, tags: ["inventory-products"] }
);
