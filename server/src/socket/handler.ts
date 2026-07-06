import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { redis } from "../db/redis";
import { updateUserLocation, isUserInProximity } from "../services/location";
import { createMessage, getMessages } from "../models/message";
import {
  isGroupMember,
  getGroupMembers,
  removeGroupMember,
} from "../models/group";
import type { AuthPayload } from "../middleware/auth";

const userSockets = new Map<string, Set<string>>();

export function setupSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const payload = jwt.verify(token, config.jwt.secret) as AuthPayload;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user as AuthPayload;
    console.log(`User connected: ${user.userId}`);

    trackUserSocket(user.userId, socket.id);

    socket.on("join:group", async (groupId: string) => {
      const member = await isGroupMember(groupId, user.userId);
      if (!member) {
        socket.emit("error", { message: "Not a member of this group" });
        return;
      }
      socket.join(`group:${groupId}`);
      socket.emit("joined:group", { groupId });

      const recentMessages = await getMessages(groupId);
      socket.emit("messages:list", recentMessages);
    });

    socket.on("leave:group", (groupId: string) => {
      socket.leave(`group:${groupId}`);
    });

    socket.on("message:send", async (data: {
      groupId: string;
      type: "text" | "image" | "location";
      content: string;
    }) => {
      const member = await isGroupMember(data.groupId, user.userId);
      if (!member) {
        socket.emit("error", { message: "Not a member of this group" });
        return;
      }

      const inProximity = await isUserInProximity(data.groupId, user.userId);
      if (!inProximity) {
        socket.emit("error", {
          message: "You are outside the 10km proximity zone",
        });
        return;
      }

      const message = await createMessage(
        data.groupId,
        user.userId,
        data.type,
        data.content
      );

      io.to(`group:${data.groupId}`).emit("message:new", message);
    });

    socket.on("location:update", async (data: {
      groupId: string;
      lat: number;
      lng: number;
    }) => {
      const member = await isGroupMember(data.groupId, user.userId);
      if (!member) return;

      await updateUserLocation(user.userId, data.groupId, {
        lat: data.lat,
        lng: data.lng,
      });

      const inProximity = await isUserInProximity(data.groupId, user.userId);
      if (!inProximity) {
        socket.emit("proximity:warning", {
          message: "You've moved outside the 10km zone. You'll be removed in 2 minutes.",
          gracePeriod: config.group.locationGracePeriodSeconds,
        });

        const key = `proximity:warning:${data.groupId}:${user.userId}`;
        const exists = await redis.get(key);
        if (!exists) {
          await redis.setex(
            key,
            config.group.locationGracePeriodSeconds,
            "pending"
          );
          setTimeout(async () => {
            const stillOutside = await isUserInProximity(
              data.groupId,
              user.userId
            );
            if (!stillOutside) {
              await removeGroupMember(data.groupId, user.userId);
              io.to(`group:${data.groupId}`).emit(
                "member:removed",
                { userId: user.userId }
              );
            }
            await redis.del(key);
          }, config.group.locationGracePeriodSeconds * 1000);
        }
      }

      const members = await getGroupMembers(data.groupId);
      io.to(`group:${data.groupId}`).emit("location:updated", {
        userId: user.userId,
        lat: data.lat,
        lng: data.lng,
      });
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${user.userId}`);
      untrackUserSocket(user.userId, socket.id);
    });
  });
}

function trackUserSocket(userId: string, socketId: string) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(socketId);
}

function untrackUserSocket(userId: string, socketId: string) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(userId);
    }
  }
}
