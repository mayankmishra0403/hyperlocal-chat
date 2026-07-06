import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  checkPhone: (phone: string) => Promise<boolean>;
  directLogin: (phone: string, displayName: string) => Promise<void>;
  loginExisting: (phone: string) => Promise<void>;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  checkPhone: async () => false,
  directLogin: async () => {},
  loginExisting: async () => {},
  sendOtp: async () => {},
  verifyOtp: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const savedToken = await AsyncStorage.getItem("token");
      const savedUser = await AsyncStorage.getItem("user");
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        await connectSocket();
      }
    } catch {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }

  const checkPhone = useCallback(async (phone: string) => {
    const { exists } = await api.checkPhone(phone);
    return exists;
  }, []);

  const directLogin = useCallback(
    async (phone: string, displayName: string) => {
      const { user: u, token: t } = await api.login({ phone, displayName });
      setUser(u);
      setToken(t);
      await AsyncStorage.setItem("token", t);
      await AsyncStorage.setItem("user", JSON.stringify(u));
      await connectSocket();
    },
    []
  );

  const loginExisting = useCallback(async (phone: string) => {
    const { user: u, token: t } = await api.loginExisting(phone);
    setUser(u);
    setToken(t);
    await AsyncStorage.setItem("token", t);
    await AsyncStorage.setItem("user", JSON.stringify(u));
    await connectSocket();
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    await api.sendOtp(phone);
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, code: string, displayName: string) => {
      const { user: u, token: t } = await api.verifyOtp(
        phone,
        code,
        displayName
      );
      setUser(u);
      setToken(t);
      await AsyncStorage.setItem("token", t);
      await AsyncStorage.setItem("user", JSON.stringify(u));
      await connectSocket();
    },
    []
  );

  const logout = useCallback(async () => {
    disconnectSocket();
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        checkPhone,
        directLogin,
        loginExisting,
        sendOtp,
        verifyOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
