"use client";

import { useState, type FormEvent } from "react";
import { CreateChannelInputSchema, CreateWorkspaceInputSchema } from "@openteams/shared-types";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";
import { DialogShell } from "./DialogShell";

export function CreateWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const parsed = CreateWorkspaceInputSchema.safeParse({ name, slug: slug || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid workspace");
      return;
    }

    setBusy(true);
    try {
      const workspace = await api.createWorkspace(parsed.data);
      await useWorkspaceStore.getState().addWorkspace(workspace);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogShell
      title="Create a workspace"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Create"
      busy={busy}
      error={error}
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="ws-name" className="mb-1 block text-sm font-medium text-slate-300">
            Name
          </label>
          <input
            id="ws-name"
            className="input-dark"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc."
            autoFocus
            minLength={2}
            maxLength={80}
            required
          />
        </div>
        <div>
          <label htmlFor="ws-slug" className="mb-1 block text-sm font-medium text-slate-300">
            Slug <span className="font-normal text-slate-500">(optional, kebab-case)</span>
          </label>
          <input
            id="ws-slug"
            className="input-dark"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="acme-inc"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={48}
          />
        </div>
      </div>
    </DialogShell>
  );
}

export function CreateChannelDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const parsed = CreateChannelInputSchema.safeParse({
      workspaceId,
      name,
      type,
      isEncrypted: false,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid channel name");
      return;
    }

    setBusy(true);
    try {
      const channel = await api.createChannel(parsed.data);
      await useWorkspaceStore.getState().addChannel(channel);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogShell
      title="Create a channel"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Create"
      busy={busy}
      error={error}
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="ch-name" className="mb-1 block text-sm font-medium text-slate-300">
            Name
          </label>
          <input
            id="ch-name"
            className="input-dark"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="engineering"
            autoFocus
            required
          />
          <p className="mt-1 text-xs text-slate-500">Lowercase letters, digits, &quot;-&quot; and &quot;_&quot; only.</p>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-300">Visibility</span>
          <div className="flex gap-2">
            {(["PUBLIC", "PRIVATE"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  type === option
                    ? "border-accent bg-accent-muted/40 text-white"
                    : "border-surface-border text-slate-400 hover:border-slate-500"
                }`}
              >
                {option === "PUBLIC" ? "Public" : "Private"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </DialogShell>
  );
}
