"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/app/lib/apiClient";
import type { User } from "@/app/types/user";
import type { ResponseData } from "@/app/types/response";

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: (redirectTo?: string | null) => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = async () => {
    setLoading(true);
    try {
      const response: ResponseData = await apiClient("/me/");

      if (!response || "detail" in response) {
        // 未ログイン状態
        setUser(null);
      } else {
        // ログイン済み
        setUser(response as User);
      }
    } catch (error: any) {
      // 401ならログインしていないだけなのでログ出さない
      if (error.status !== 401) {
        console.error("Error fetching user:", error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await apiClient("/token/", {
        method: "POST",
        body: {
          email,
          password,
        },
      });

      // ユーザー情報取得
      await fetchUser();
    } catch (err) {
      console.error("ログインエラー:", err);
      throw err;
    }
  };

  const logout = async (redirectTo: string | null = "/") => {
    try {
      await apiClient("/logout/", { method: "POST" }, false);
    } catch (err) {
      console.error("ログアウトエラー:", err);
      // 失敗しても次へ
    } finally {
      setUser(null);
      if (redirectTo) {
        router.push(redirectTo);
      }
    }
  };

  // F5対策
  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
