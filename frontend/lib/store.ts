import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "@/lib/api";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  subscription_tier: "free" | "premium";
  target_role?: string;
  experience_level?: string;
  stats?: { total_interviews: number; avg_score: number | null };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setTokens: (access: string, refresh: string, userId: string, email: string, fullName: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      setTokens: (access, refresh, userId, email, fullName) => {
        api.defaults.headers.common["Authorization"] = `Bearer ${access}`;
        set({
          accessToken: access,
          refreshToken: refresh,
          user: { id: userId, email, full_name: fullName, avatar_url: null, subscription_tier: "free" },
        });
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post("/auth/login", { email, password });
          get().setTokens(data.access_token, data.refresh_token, data.user_id, data.email, data.full_name);
          await get().refreshProfile();
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (email, password, fullName) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post("/auth/register", { email, password, full_name: fullName });
          get().setTokens(data.access_token, data.refresh_token, data.user_id, data.email, data.full_name);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try { await api.post("/auth/logout"); } catch {}
        delete api.defaults.headers.common["Authorization"];
        set({ user: null, accessToken: null, refreshToken: null });
      },

      refreshProfile: async () => {
        try {
          const { data } = await api.get("/users/me");
          set((s) => ({ user: { ...s.user!, ...data } }));
        } catch {}
      },
    }),
    {
      name: "interviewai-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
