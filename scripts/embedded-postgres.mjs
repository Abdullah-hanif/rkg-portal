import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseDir = path.join(root, ".pgdata");

const postgres = new EmbeddedPostgres({
  databaseDir,
  user: "rkg",
  password: "rkg",
  port: 5432,
  persistent: true,
});

if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
  await postgres.initialise();
}

await postgres.start();

for (const name of ["rkg", "rkg_test"]) {
  try {
    await postgres.createDatabase(name);
    console.log(`created database ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) throw error;
  }
}

console.log("Postgres listening on localhost:5432");
await new Promise(() => {});
