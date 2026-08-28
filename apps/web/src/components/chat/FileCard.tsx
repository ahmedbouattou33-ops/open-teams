"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, File as FileIcon, FileImage, FileText, Film, Loader2, Music } from "lucide-react";
import { api } from "@/lib/api";
import { audit, auditActions } from "@/lib/audit";
import { errorMessage } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace";

function iconForMime(mimeType: string): React.ReactNode {
  if (mimeType.startsWith("image/")) return <FileImage className="h-5 w-5 text-emerald-400" />;
  if (mimeType.startsWith("video/")) return <Film className="h-5 w-5 text-violet-400" />;
  if (mimeType.startsWith("audio/")) return <Music className="h-5 w-5 text-sky-400" />;
  if (mimeType.startsWith("text/") || mimeType.includes("json")) return <FileText className="h-5 w-5 text-amber-400" />;
  return <FileIcon className="h-5 w-5 text-slate-400" />;
}

export function FileCard({
  fileId,
  name,
  mimeType,
  size,
}: {
  fileId: string;
  name: string;
  mimeType?: string;
  size?: number;
}) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inlineUrl, setInlineUrl] = useState<string | null>(null);

  const openOrFetch = useCallback(async (): Promise<void> => {
    if (!activeWorkspaceId) {
      setError("No workspace selected");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const download = await api.downloadUrl(fileId, activeWorkspaceId);
      setInlineUrl(download.downloadUrl);
      audit(auditActions.fileDownload, {
        target: name,
        details: `Presigned URL issued (${download.expiresIn}s TTL)`,
      });
      window.open(download.downloadUrl, "_blank", "noopener");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [activeWorkspaceId, fileId]);

  const inlinePreview = mimeType?.startsWith("image/") && inlineUrl;

  useEffect(() => {
    if (!activeWorkspaceId || !mimeType?.startsWith("image/") || inlineUrl) return;
    let cancelled = false;
    void api.downloadUrl(fileId, activeWorkspaceId).then((download) => { if (!cancelled) setInlineUrl(download.downloadUrl); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [activeWorkspaceId, fileId, inlineUrl, mimeType]);

  return (
    <span className="my-1 block max-w-sm">
      <button
        type="button"
        onClick={() => void openOrFetch()}
        disabled={busy}
        className="flex w-full items-center gap-3 rounded-xl border border-surface-border bg-surface-raised px-3 py-2.5 text-left transition-colors hover:border-accent disabled:opacity-60"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/30">
          {busy ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : iconForMime(mimeType ?? "")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{name}</span>
          <span className="block text-xs text-slate-500">
            {size !== undefined ? `${(size / 1024).toFixed(0)} KB · ` : ""}{mimeType?.startsWith("image/") ? "Image preview · " : ""}Click to download
          </span>
        </span>
        <Download className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
      {inlinePreview ? (
        // eslint-disable-next-line @jsx-a11y/alt-text
        <img src={inlineUrl} alt={name} className="mt-1 max-h-64 rounded-xl border border-surface-border" />
      ) : null}
      {error ? <span className="mt-1 block text-xs text-rose-400">{error}</span> : null}
    </span>
  );
}

export { iconForMime };
