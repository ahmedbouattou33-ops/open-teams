"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw, X } from "lucide-react";
import type { FileDTO } from "@openteams/shared-types";
import { api } from "@/lib/api";
import { audit, auditActions } from "@/lib/audit";
import { errorMessage, formatBytes } from "@/lib/utils";
import { iconForMime } from "@/components/chat/FileCard";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";

export default function FilesDrawer() {
  const setFilesDrawerOpen = useUiStore((s) => s.setFilesDrawerOpen);
  const activeChannelId = useWorkspaceStore((s) => s.activeChannelId);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const [files, setFiles] = useState<readonly FileDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!activeChannelId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.listChannelFiles({ channelId: activeChannelId, limit: 50, offset: 0 });
      setFiles(result.files.filter((f) => f.status === "UPLOADED"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeChannelId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <aside className="flex h-full w-80 shrink-0 animate-fade-in flex-col border-l border-surface-border bg-surface-raised">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-surface-border px-4">
        <h2 className="text-sm font-bold text-white">File vault</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Refresh"
            onClick={() => void refresh()}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-surface-hover hover:text-white"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </button>
          <button
            type="button"
            title="Close"
            onClick={() => setFilesDrawerOpen(false)}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-surface-hover hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {error ? <li className="p-2 text-sm text-rose-400">{error}</li> : null}
        {!error && files.length === 0 && !loading ? (
          <li className="p-3 text-xs text-slate-500">
            No files shared in this channel yet. Attach one from the composer.
          </li>
        ) : null}
        {files.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            workspaceId={activeWorkspaceId ?? ""}
          />
        ))}
      </ul>
    </aside>
  );
}

function FileRow({ file, workspaceId }: { file: FileDTO; workspaceId: string }) {
  const [busy, setBusy] = useState(false);

  async function download(): Promise<void> {
    if (!workspaceId || busy) return;
    setBusy(true);
    try {
      const download = await api.downloadUrl(file.id, workspaceId);
      audit(auditActions.fileDownload, {
        target: file.fileName,
        details: `Vault download via presigned URL (${download.expiresIn}s TTL)`,
      });
      window.open(download.downloadUrl, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <div className="flex items-center gap-2.5 rounded-xl border border-surface-border bg-surface px-3 py-2.5 transition-colors hover:border-accent/60">
        {iconForMime(file.mimeType)}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium text-white" title={file.fileName}>
            {file.fileName}
          </p>
          <p className="text-[11px] text-slate-500">
            {formatBytes(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button
          type="button"
          title="Download (presigned URL)"
          onClick={() => void download()}
          disabled={busy}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-hover hover:text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>
      </div>
    </li>
  );
}
