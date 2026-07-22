import dotenv from "dotenv"
import { defineConfig } from "drizzle-kit"

dotenv.config({
  path: "../../apps/server/.env",
})

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  // Crikket owns only the `crikket` schema. `public` holds the Paper Tiger
  // dashboard tables (projects, people, …) which we read but never manage.
  schemaFilter: ["crikket"],
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
})
