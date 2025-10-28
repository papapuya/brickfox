import { defineConfig } from "drizzle-kit";

// Use SQLite for development, PostgreSQL for production
const isDevelopment = process.env.NODE_ENV === 'development';

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: isDevelopment ? "sqlite" : "postgresql",
  dbCredentials: isDevelopment ? {
    url: "local.db",
  } : {
    url: process.env.DATABASE_URL!,
  },
});
