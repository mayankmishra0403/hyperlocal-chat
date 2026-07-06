import { deactivateExpiredGroups, deleteGroup, purgeOldLocations } from "../models/group";
import { deleteMessagesByGroup } from "../models/message";

let intervalHandle: NodeJS.Timeout | null = null;

export function startGroupExpiryJob(intervalMs = 60_000) {
  console.log(`Group expiry job started (checking every ${intervalMs / 1000}s)`);
  intervalHandle = setInterval(async () => {
    try {
      const expiredIds = await deactivateExpiredGroups();
      for (const groupId of expiredIds) {
        await deleteMessagesByGroup(groupId);
        await deleteGroup(groupId);
      }
      if (expiredIds.length > 0) {
        console.log(`Cleaned up ${expiredIds.length} expired groups`);
      }

      const purged = await purgeOldLocations(24);
      if (purged > 0) {
        console.log(`Purged ${purged} old location records`);
      }
    } catch (err) {
      console.error("Group expiry job error:", err);
    }
  }, intervalMs);
}

export function stopGroupExpiryJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
