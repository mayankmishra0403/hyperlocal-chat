import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Message, LocationCoords } from "../types";
import { appConfig } from "./config";

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem("token");
  socket = io(appConfig.socketUrl, {
    auth: { token },
    transports: ["websocket"],
  });

  return new Promise((resolve, reject) => {
    socket!.on("connect", () => resolve(socket!));
    socket!.on("connect_error", (err) => reject(err));
    setTimeout(() => reject(new Error("Socket timeout")), 10000);
  });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinGroup(groupId: string) {
  socket?.emit("join:group", groupId);
}

export function leaveGroup(groupId: string) {
  socket?.emit("leave:group", groupId);
}

export function sendMessage(
  groupId: string,
  type: "text" | "image" | "location",
  content: string
) {
  socket?.emit("message:send", { groupId, type, content });
}

export function updateLocation(groupId: string, coords: LocationCoords) {
  socket?.emit("location:update", { groupId, ...coords });
}

export function onNewMessage(callback: (msg: Message) => void) {
  socket?.on("message:new", callback);
  return () => socket?.off("message:new", callback);
}

export function onMessagesList(callback: (msgs: Message[]) => void) {
  socket?.on("messages:list", callback);
  return () => socket?.off("messages:list", callback);
}

export function onJoinedGroup(callback: (data: { groupId: string }) => void) {
  socket?.on("joined:group", callback);
  return () => socket?.off("joined:group", callback);
}

export function onProximityWarning(
  callback: (data: { message: string; gracePeriod: number }) => void
) {
  socket?.on("proximity:warning", callback);
  return () => socket?.off("proximity:warning", callback);
}

export function onMemberRemoved(
  callback: (data: { userId: string }) => void
) {
  socket?.on("member:removed", callback);
  return () => socket?.off("member:removed", callback);
}

export function onLocationUpdated(
  callback: (data: { userId: string; lat: number; lng: number }) => void
) {
  socket?.on("location:updated", callback);
  return () => socket?.off("location:updated", callback);
}

export function offAll() {
  socket?.removeAllListeners();
}

export function getSocket() {
  return socket;
}
