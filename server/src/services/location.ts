import { query } from "../db/pool";
import { config } from "../config";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export async function updateUserLocation(
  userId: string,
  groupId: string,
  point: GeoPoint
): Promise<void> {
  await query(
    `UPDATE group_members
     SET last_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
         location_updated_at = NOW()
     WHERE user_id = $3 AND group_id = $4`,
    [point.lng, point.lat, userId, groupId]
  );

  await query(
    `INSERT INTO location_history (user_id, location)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326))`,
    [userId, point.lng, point.lat]
  );
}

export async function getMembersWithinRadius(
  groupId: string,
  userId: string
): Promise<{ userId: string; distance: number }[]> {
  const result = await query(
    `SELECT gm.user_id,
            ST_Distance(
              gm.last_location,
              (SELECT last_location FROM group_members WHERE group_id = $1 AND user_id = $2)
            ) AS distance
     FROM group_members gm
     WHERE gm.group_id = $1
       AND gm.user_id != $2
       AND gm.last_location IS NOT NULL`,
    [groupId, userId]
  );
  return result.rows.map((r) => ({
    userId: r.user_id,
    distance: parseFloat(r.distance),
  }));
}

export async function isUserInProximity(
  groupId: string,
  userId: string
): Promise<boolean> {
  const members = await getMembersWithinRadius(groupId, userId);
  if (members.length === 0) return true;
  return members.every(
    (m) => m.distance <= config.group.proximityRadiusMeters
  );
}

export async function findNearbyGroups(
  point: GeoPoint,
  userId: string
): Promise<any[]> {
  const result = await query(
    `SELECT DISTINCT g.*,
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE g.is_active = TRUE
       AND g.expires_at > NOW()
       AND gm.last_location IS NOT NULL
       AND ST_DWithin(
         gm.last_location,
         ST_SetSRID(ST_MakePoint($1, $2), 4326),
         $3
       )
       AND g.id NOT IN (
         SELECT group_id FROM group_members WHERE user_id = $4
       )
     ORDER BY g.created_at DESC`,
    [point.lng, point.lat, config.group.proximityRadiusMeters, userId]
  );
  return result.rows;
}

export async function getGroupCentroid(
  groupId: string
): Promise<GeoPoint | null> {
  const result = await query(
    `SELECT ST_AsGeoJSON(ST_Centroid(ST_Collect(last_location))) AS centroid
     FROM group_members
     WHERE group_id = $1 AND last_location IS NOT NULL`,
    [groupId]
  );
  if (!result.rows[0]?.centroid) return null;
  const coords = JSON.parse(result.rows[0].centroid).coordinates;
  return { lng: coords[0], lat: coords[1] };
}
