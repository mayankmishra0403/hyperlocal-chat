import { query } from "../db/pool";

export interface User {
  id: string;
  phone: string;
  display_name: string;
  photo_url: string | null;
  created_at: Date;
  last_active_at: Date;
}

export async function createUser(
  phone: string,
  displayName: string
): Promise<User> {
  const result = await query(
    `INSERT INTO users (phone, display_name) VALUES ($1, $2)
     ON CONFLICT (phone) DO UPDATE SET last_active_at = NOW()
     RETURNING *`,
    [phone, displayName]
  );
  return result.rows[0];
}

export async function findUserByPhone(phone: string): Promise<User | null> {
  const result = await query("SELECT * FROM users WHERE phone = $1", [phone]);
  return result.rows[0] || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function updateLastActive(id: string): Promise<void> {
  await query("UPDATE users SET last_active_at = NOW() WHERE id = $1", [id]);
}

export async function updateDisplayName(
  id: string,
  displayName: string
): Promise<User> {
  const result = await query(
    "UPDATE users SET display_name = $1 WHERE id = $2 RETURNING *",
    [displayName, id]
  );
  return result.rows[0];
}
