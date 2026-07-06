import { query } from "../db/pool";
import { config } from "../config";

export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: Date;
  expires_at: Date;
  extended: boolean;
  is_active: boolean;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: Date;
  last_location: any;
  location_updated_at: Date | null;
}

export async function createGroup(
  name: string,
  description: string | undefined,
  createdBy: string
): Promise<Group> {
  const expiresAt = new Date(
    Date.now() + config.group.maxDurationHours * 60 * 60 * 1000
  );
  const result = await query(
    `INSERT INTO groups (name, description, created_by, expires_at)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, description || null, createdBy, expiresAt]
  );
  return result.rows[0];
}

export async function findGroupById(id: string): Promise<Group | null> {
  const result = await query("SELECT * FROM groups WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function getMyGroups(userId: string): Promise<Group[]> {
  const result = await query(
    `SELECT g.*,
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1 AND g.is_active = TRUE
     ORDER BY g.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function addGroupMember(
  groupId: string,
  userId: string,
  role: "admin" | "member" = "member"
): Promise<GroupMember> {
  const result = await query(
    `INSERT INTO group_members (group_id, user_id, role)
     VALUES ($1, $2, $3) RETURNING *`,
    [groupId, userId, role]
  );
  return result.rows[0];
}

export async function removeGroupMember(
  groupId: string,
  userId: string
): Promise<void> {
  await query(
    "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId]
  );
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const result = await query(
    "SELECT * FROM group_members WHERE group_id = $1",
    [groupId]
  );
  return result.rows;
}

export async function getMemberCount(groupId: string): Promise<number> {
  const result = await query(
    "SELECT COUNT(*) FROM group_members WHERE group_id = $1",
    [groupId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function isGroupMember(
  groupId: string,
  userId: string
): Promise<boolean> {
  const result = await query(
    "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId]
  );
  return result.rows.length > 0;
}

export async function extendGroupExpiry(groupId: string): Promise<Group | null> {
  const group = await findGroupById(groupId);
  if (!group || group.extended) return null;

  const newExpiry = new Date(
    group.expires_at.getTime() + 60 * 60 * 1000
  );
  const result = await query(
    "UPDATE groups SET expires_at = $1, extended = TRUE WHERE id = $2 RETURNING *",
    [newExpiry, groupId]
  );
  return result.rows[0];
}

export async function deactivateExpiredGroups(): Promise<string[]> {
  const result = await query(
    `UPDATE groups SET is_active = FALSE
     WHERE is_active = TRUE AND expires_at < NOW()
     RETURNING id`
  );
  return result.rows.map((r) => r.id);
}

export async function deleteGroup(groupId: string): Promise<void> {
  await query("DELETE FROM groups WHERE id = $1", [groupId]);
}

export async function purgeOldLocations(
  olderThanHours = 24
): Promise<number> {
  const result = await query(
    "DELETE FROM location_history WHERE recorded_at < NOW() - INTERVAL '1 hour' * $1",
    [olderThanHours]
  );
  return result.rowCount ?? 0;
}
