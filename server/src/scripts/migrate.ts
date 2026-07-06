import { runMigrations } from "../db/migrate";

async function main() {
  await runMigrations();
  process.exit(0);
}

main();
