import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SsoProvider = "NONE" | "SAML" | "OIDC" | "LDAP";

export interface SsoConfig {
  readonly provider: SsoProvider;
  readonly ldapUrl: string;
  readonly baseDn: string;
  readonly bindUser: string;
  readonly idpMetadataUrl: string;
  readonly enforceMfa: boolean;
}

interface SecurityState {
  readonly watermarkEnabled: boolean;
  readonly ssoConfig: SsoConfig;
  readonly emergencyLocked: boolean;
  setWatermarkEnabled: (enabled: boolean) => void;
  saveSsoConfig: (config: SsoConfig) => void;
  setEmergencyLocked: (locked: boolean) => void;
}

export const DEFAULT_SSO_CONFIG: SsoConfig = {
  provider: "NONE",
  ldapUrl: "",
  baseDn: "",
  bindUser: "",
  idpMetadataUrl: "",
  enforceMfa: false,
};

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set) => ({
      watermarkEnabled: false,
      ssoConfig: DEFAULT_SSO_CONFIG,
      emergencyLocked: false,
      setWatermarkEnabled: (enabled) => set({ watermarkEnabled: enabled }),
      saveSsoConfig: (config) => set({ ssoConfig: config }),
      setEmergencyLocked: (locked) => set({ emergencyLocked: locked }),
    }),
    {
      name: "openteams.security.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        watermarkEnabled: state.watermarkEnabled,
        ssoConfig: state.ssoConfig,
      }),
    },
  ),
);
