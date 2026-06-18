"use client";

import * as React from "react";
import { publicEnv } from "@/lib/env";

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

type AuthContextType = {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ step: "complete" | "2fa" | "otp"; userId?: string; email?: string }>;
  verify2fa: (userId: string, code: string) => Promise<void>;
  verifyOtp: (userId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  const apiFetch = React.useCallback(async (path: string, options: RequestInit = {}) => {
    const baseUrl = publicEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
    const url = path.startsWith("http") ? path : `${baseUrl}/${path.replace(/^\//, "")}`;
    
    const response = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return response.json();
  }, []);

  const refreshUser = React.useCallback(async () => {
    try {
      const meData = await apiFetch("/auth/me");
      if (meData && meData.role) {
        // Ensure it is an employee/admin role, not customer (though backend will dictate rights)
        setUser({
          id: meData.userId,
          email: meData.email,
          fullName: meData.email.split("@")[0].toUpperCase(),
          role: meData.role,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  // Initial session check
  React.useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (data.step === "complete") {
      await refreshUser();
    }
    return data;
  };

  const verify2fa = async (userId: string, code: string) => {
    await apiFetch("/auth/verify-2fa", {
      method: "POST",
      body: JSON.stringify({ userId, code }),
    });
    await refreshUser();
  };

  const verifyOtp = async (userId: string, code: string) => {
    await apiFetch("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ userId, code }),
    });
    await refreshUser();
  };

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Proceed with local logout anyway
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        verify2fa,
        verifyOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
