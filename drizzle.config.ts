import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL || process.env.POSTGRES_URL || "postgres://comic:comic@localhost:5432/comicdb" },
});
