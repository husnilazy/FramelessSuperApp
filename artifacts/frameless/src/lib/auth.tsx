import {
  createContext, useContext, useEffect, useState,
  useCallback, type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  refetch: async () => {},
});

const API_BASE_URL = import.meta.env.PROD
  ? "https://frameless-super-app-api-server.vercel.app"
  : "";

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

async function fetchMe(token: string): Promise<User | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    const cached = localStorage.getItem("user");
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {
        localStorage.removeItem("user");
      }
    }

    fetchMe(token).then((me) => {
      if (me) {
        setUser(me);
        localStorage.setItem("user", JSON.stringify(me));
      } else {
        clearToken();
        setUser(null);
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback((token: string, userData: User) => {
    setToken(token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    queryClient.clear();
  }, [queryClient]);

  const logout = useCallback(() => {
    const token = getToken();
    if (token) {
      fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    clearToken();
    setUser(null);
    queryClient.clear();
    setLocation("/login");
  }, [queryClient, setLocation]);

  const refetch = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    const me = await fetchMe(token);
    if (me) {
      setUser(me);
      localStorage.setItem("user", JSON.stringify(me));
    } else {
      clearToken();
      setUser(null);
      setLocation("/login");
    }
  }, [setLocation]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div style={{
        height: "100vh", width: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0a0a0c",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,.1)",
          borderTopColor: "#FF6A20",
          animation: "spin .7s linear infinite",
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}