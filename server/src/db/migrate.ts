import fs from "fs";
import path from "path";
import { pool, query } from "./pool";

export async function runMigrations() {
  const sqlPath = path.join(__dirname, "../../migrations/001_initial.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("Migration file not found:", sqlPath);
    return;
  }

  const sql = fs.readFileSync(sqlPath, "utf-8");

  try {
    await query("SELECT 1 FROM users LIMIT 1");
    console.log("Tables already exist, skipping migration");
    return;
  } catch {
    console.log("Running initial migration...");
    await pool.query(sql);
    console.log("Migration completed successfully");
  }
}
