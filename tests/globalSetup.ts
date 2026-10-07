import { execSync } from "node:child_process";
import { Client } from "pg";

const adminUrl = "postgresql://rkg:rkg@localhost:5432/rkg";
const testUrl = "postgresql://rkg:rkg@localhost:5432/rkg_test?schema=public";

export default async function setup() {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = 'rkg_test'");
  if (existing.rowCount === 0) {
    await client.query("CREATE DATABASE rkg_test");
  }
  await client.end();

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
