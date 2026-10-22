import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

// Prisma 7: connection URLs live here, not in schema.prisma.
// Migrations use the direct Neon string; the app uses the pooled DATABASE_URL through a driver adapter.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"] ?? "" },
});
