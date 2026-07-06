import { query } from "../db/pool";

export interface Message {
  id: string;
  group_id: string;
  sender_id: string;
  type: "text" | "image" | "location";
  content: string;
  created_at: Date;
}

export async function createMessage(
  groupId: string,
  senderId: string,
  type: "text" | "image" | "location",
  content: string
): Promise<Message> {
  const result = await query(
    `INSERT INTO messages (group_id, sender_id, type, content)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [groupId, senderId, type, content]
  );
  return result.rows[0];
}

export async function getMessages(
  groupId: string,
  limit = 50,
  before?: string
): Promise<Message[]> {
  let result;
  if (before) {
    result = await query(
      `SELECT * FROM messages
       WHERE group_id = $1 AND created_at < $2
       ORDER BY created_at DESC LIMIT $3`,
      [groupId, before, limit]
    );
  } else {
    result = await query(
      `SELECT * FROM messages
       WHERE group_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [groupId, limit]
    );
  }
  return result.rows.reverse();
}

export async function deleteMessagesByGroup(
  groupId: string
): Promise<void> {
  await query("DELETE FROM messages WHERE group_id = $1", [groupId]);
}
