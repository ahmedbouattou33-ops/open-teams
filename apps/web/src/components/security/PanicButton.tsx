"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { audit, auditActions } from "@/lib/audit";
import { disconnectRealtime } from "@/hooks/use-realtime";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";

export default function PanicButton() {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setConfirming(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function triggerLock(): void {
    audit(auditActions.panicLock, {
      severity: "CRITICAL",
      details: "Emergency lock triggered; all local sessions terminated",
    });
    disconnectRealtime();
    useAuthStore.getState().clearSession();
    useWorkspaceStore.getState().reset();
    setConfirming(false);
    window.location.href = "/login?locked=1";
  }

  return (
    <>
      <button
        type="button"
        title="Emergency lock (Ctrl+Shift+L)"
        onClick={() => setConfirming(true)}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-rose-500/40 bg-surface-overlay/90 px-3 py-2 text-xs font-bold uppercase tracking-wide text-rose-300 shadow-xl backdrop-blur transition-colors hover:bg-rose-500/20"
      >
        <ShieldAlert className="h-4 w-4" />
        Panic
      </button>

      {confirming ? (
        <div
          className="fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-black/70 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/40 bg-surface-overlay p-6 shadow-2xl">
            <h2 className="flex items-center gap-2 text-lg font-bold text-rose-300">
              <ShieldAlert className="h-5 w-5" /> Emergency lock
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              This instantly terminates every active session on this device, clears cached workspace
              data and locks the workspace. The action is written to the immutable audit trail.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={triggerLock}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-500"
              >
                Lock everything now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
