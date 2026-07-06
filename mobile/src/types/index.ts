export interface User {
  id: string;
  phone: string;
  display_name: string;
  photo_url: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  expires_at: string;
  extended: boolean;
  is_active: boolean;
  member_count?: number;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  last_location?: { lat: number; lng: number };
}

export interface Message {
  id: string;
  group_id: string;
  sender_id: string;
  type: "text" | "image" | "location";
  content: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface LoginPayload {
  phone: string;
  displayName: string;
}
