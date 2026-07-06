import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthResponse, Group, GroupMember, LoginPayload } from "../types";
import { appConfig } from "./config";

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${appConfig.apiUrl}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  checkPhone(phone: string) {
    return request<{ exists: boolean }>("/auth/check", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  },

  sendOtp(phone: string) {
    return request<{ message: string }>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  },

  verifyOtp(phone: string, code: string, displayName: string) {
    return request<AuthResponse>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code, displayName }),
    });
  },

  login(payload: LoginPayload) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  loginExisting(phone: string) {
    return request<AuthResponse>("/auth/login-existing", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  },

  getNearbyGroups(lat: number, lng: number) {
    return request<Group[]>(`/groups/nearby?lat=${lat}&lng=${lng}`);
  },

  getGroup(id: string) {
    return request<Group>(`/groups/${id}`);
  },

  createGroup(name: string, description?: string, lat?: number, lng?: number) {
    return request<Group>("/groups", {
      method: "POST",
      body: JSON.stringify({ name, description, lat, lng }),
    });
  },

  getMyGroups() {
    return request<Group[]>("/groups/my");
  },

  joinGroup(id: string) {
    return request<GroupMember>(`/groups/${id}/join`, { method: "POST" });
  },

  leaveGroup(id: string) {
    return request<void>(`/groups/${id}/leave`, { method: "POST" });
  },

  getGroupMembers(id: string) {
    return request<GroupMember[]>(`/groups/${id}/members`);
  },

  extendGroup(id: string) {
    return request<Group>(`/groups/${id}/extend`, { method: "POST" });
  },

  deleteGroup(id: string) {
    return request<void>(`/groups/${id}`, { method: "DELETE" });
  },

  truecallerLogin(requestId: string, phone: string, displayName?: string) {
    return request<AuthResponse>("/auth/truecaller", {
      method: "POST",
      body: JSON.stringify({ requestId, phone, displayName }),
    });
  },
};
