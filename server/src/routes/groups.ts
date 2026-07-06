import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import {
  createGroup,
  findGroupById,
  addGroupMember,
  removeGroupMember,
  getGroupMembers,
  getMemberCount,
  isGroupMember,
  extendGroupExpiry,
  getMyGroups,
  deleteGroup,
} from "../models/group";
import { findNearbyGroups, updateUserLocation } from "../services/location";
import { config } from "../config";

const router = Router();
router.use(authMiddleware);

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(s: string) {
  return UUID_REGEX.test(s);
}
function requireValidGroup(req: Request, res: Response): boolean {
  if (!isValidUuid(req.params.id)) {
    res.status(404).json({ error: "Group not found" });
    return false;
  }
  return true;
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = createGroupSchema.parse(req.body);
    const group = await createGroup(
      body.name,
      body.description,
      req.user!.userId
    );
    await addGroupMember(group.id, req.user!.userId, "admin");

    if (body.lat !== undefined && body.lng !== undefined) {
      await updateUserLocation(req.user!.userId, group.id, {
        lat: body.lat,
        lng: body.lng,
      });
    }

    res.status(201).json(group);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("Create group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/my", async (req: Request, res: Response) => {
  try {
    const groups = await getMyGroups(req.user!.userId);
    res.json(groups);
  } catch (err) {
    console.error("My groups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/nearby", async (req: Request, res: Response) => {
  try {
    const loc = locationSchema.parse({
      lat: parseFloat(req.query.lat as string),
      lng: parseFloat(req.query.lng as string),
    });
    const groups = await findNearbyGroups(loc, req.user!.userId);
    res.json(groups);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("Nearby groups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    if (!requireValidGroup(req, res)) return;
    const group = await findGroupById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    const memberCount = await getMemberCount(group.id);
    res.json({ ...group, member_count: memberCount });
  } catch (err) {
    console.error("Get group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/join", async (req: Request, res: Response) => {
  try {
    if (!requireValidGroup(req, res)) return;
    const group = await findGroupById(req.params.id);
    if (!group || !group.is_active) {
      res.status(404).json({ error: "Group not found or expired" });
      return;
    }

    const alreadyMember = await isGroupMember(group.id, req.user!.userId);
    if (alreadyMember) {
      res.status(400).json({ error: "Already a member" });
      return;
    }

    const memberCount = await getMemberCount(group.id);
    if (memberCount >= config.group.maxMembers) {
      res.status(400).json({ error: "Group is full" });
      return;
    }

    const member = await addGroupMember(group.id, req.user!.userId);
    res.status(201).json(member);
  } catch (err) {
    console.error("Join group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/leave", async (req: Request, res: Response) => {
  try {
    if (!requireValidGroup(req, res)) return;
    const member = await isGroupMember(req.params.id, req.user!.userId);
    if (!member) {
      res.status(400).json({ error: "Not a member of this group" });
      return;
    }
    await removeGroupMember(req.params.id, req.user!.userId);
    res.json({ message: "Left group" });
  } catch (err) {
    console.error("Leave group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/members", async (req: Request, res: Response) => {
  try {
    if (!requireValidGroup(req, res)) return;
    const isMember = await isGroupMember(req.params.id, req.user!.userId);
    if (!isMember) {
      res.status(403).json({ error: "Only group members can view members" });
      return;
    }
    const members = await getGroupMembers(req.params.id);
    res.json(members);
  } catch (err) {
    console.error("Get members error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/extend", async (req: Request, res: Response) => {
  try {
    if (!requireValidGroup(req, res)) return;
    const group = await findGroupById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    if (group.created_by !== req.user!.userId) {
      res.status(403).json({ error: "Only the group creator can extend" });
      return;
    }
    const updated = await extendGroupExpiry(req.params.id);
    if (!updated) {
      res.status(400).json({ error: "Group already extended once" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("Extend group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    if (!isValidUuid(req.params.id)) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    const group = await findGroupById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    if (group.created_by !== req.user!.userId) {
      res.status(403).json({ error: "Only the group creator can delete" });
      return;
    }
    await deleteGroup(req.params.id);
    res.json({ message: "Group deleted" });
  } catch (err) {
    console.error("Delete group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
