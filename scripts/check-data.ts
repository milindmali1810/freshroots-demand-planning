import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const tables = [
    ["Distributor", () => db.distributor.count(), () => db.distributor.findMany({ take: 3 })],
    ["Sku", () => db.sku.count(), () => db.sku.findMany({ take: 3 })],
    ["WeeklySale", () => db.weeklySale.count(), () => db.weeklySale.findMany({ take: 3, orderBy: { weekStart: "desc" } })],
    ["InventorySnapshot", () => db.inventorySnapshot.count(), () => db.inventorySnapshot.findMany({ take: 3 })],
    ["Festival", () => db.festival.count(), () => db.festival.findMany({ take: 3 })],
  ] as const;
  for (const [name, count, sample] of tables) {
    console.log(`\n${name}: ${await count()} rows`);
    console.table(await sample());
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
