import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthResult, UserDTO } from "@openteams/shared-types";

interface AuthState {
  readonly user: UserDTO | null;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  setSession: (session: AuthResult) => void;
  setUser: (user: UserDTO) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ user, tokens }) =>
        set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: "openteams.auth.v1", storage: createJSONStorage(() => localStorage) },
  ),
);
