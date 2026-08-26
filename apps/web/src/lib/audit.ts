import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAuthStore } from "@/stores/auth";

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface AuditEvent {
  readonly id: string;
  readonly at: string;
  readonly actor: string;
  readonly action: string;
  readonly severity: AuditSeverity;
  readonly target?: string;
  readonly details?: string;
}

interface AuditState {
  readonly events: readonly AuditEvent[];
  record: (
    action: string,
    options?: { severity?: AuditSeverity; target?: string; details?: string },
  ) => void;
  clear: () => void;
}

const MAX_EVENTS = 2_000;

export const auditActions = {
  login: "auth.login",
  register: "auth.register",
  logout: "auth.logout",
  channelCreate: "permission.channel.create",
  workspaceCreate: "permission.workspace.create",
  fileDownload: "file.download",
  fileUpload: "file.upload",
  backupCreate: "compliance.backup.create",
  legalExport: "compliance.legal.export",
  stampCreate: "compliance.stamp.create",
  stampVerify: "compliance.stamp.verify",
  panicLock: "security.emergency_lock",
  ssoConfigChange: "security.sso.config",
  watermarkToggle: "security.watermark.toggle",
  whistleblow: "compliance.whistleblow.submit",
  simulationCreate: "security.simulation.create",
} as const;

export const useAuditStore = create<AuditState>()(
  persist(
    (set) => ({
      events: [],
      record: (action, options) =>
        set((state) => ({
          events: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              at: new Date().toISOString(),
              actor: useAuthStore.getState().user?.email ?? "anonymous",
              action,
              severity: options?.severity ?? "INFO",
              target: options?.target,
              details: options?.details,
            },
            ...state.events,
          ].slice(0, MAX_EVENTS),
        })),
      clear: () => set({ events: [] }),
    }),
    { name: "openteams.audit.v1", storage: createJSONStorage(() => localStorage) },
  ),
);

export function audit(
  action: string,
  options?: { severity?: AuditSeverity; target?: string; details?: string },
): void {
  useAuditStore.getState().record(action, options);
}
