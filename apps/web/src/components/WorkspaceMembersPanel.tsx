"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, RefreshCw, Users, X } from "lucide-react";
import { useUiStore } from "@/stores/ui";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace";
import type { WorkspaceInviteDTO, WorkspaceMemberDTO } from "@openteams/shared-types";
import { subscribeRealtime } from "@/hooks/use-realtime";

export default function WorkspaceMembersPanel() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const open = useUiStore((s) => s.membersOpen);
  const setOpen = useUiStore((s) => s.setMembersOpen);
  const presence = useUiStore((s) => workspaceId ? s.presenceByWorkspace[workspaceId] : undefined);
  const [members, setMembers] = useState<readonly WorkspaceMemberDTO[]>([]);
  const [invites, setInvites] = useState<readonly WorkspaceInviteDTO[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function refresh() { if (!workspaceId) return; setBusy(true); setError(null); try { setMembers(await api.listWorkspaceMembers({ workspaceId })); try { setInvites(await api.listWorkspaceInvites({ workspaceId })); } catch { setInvites([]); } } catch (e) { setError(e instanceof Error ? e.message : "Unable to load members"); } finally { setBusy(false); } }
  useEffect(() => { void refresh(); }, [workspaceId]);
  useEffect(() => {
    if (!workspaceId) return;
    return subscribeRealtime((event) => {
      if (event.type !== "member.joined" || event.workspaceId !== workspaceId) return;
      setMembers((current) => current.some((member) => member.userId === event.userId) ? current : [...current, {
        id: event.userId,
        workspaceId: event.workspaceId,
        userId: event.userId,
        displayName: event.displayName,
        email: event.email ?? "",
        role: event.role,
        status: "ONLINE",
        joinedAt: event.joinedAt,
      }]);
    });
  }, [workspaceId]);
  async function createInvite() { if (!workspaceId) return; setBusy(true); setError(null); try { const result = await api.createInvite({ workspaceId, role: "MEMBER", expiresInHours: 168, channelIds: [], directAdd: false }); const absolute = `${window.location.origin}${result.inviteUrl}`; setInviteUrl(absolute); await navigator.clipboard?.writeText(absolute); } catch (e) { setError(e instanceof Error ? e.message : "Only team admins can create invites"); } finally { setBusy(false); } }
  if (!open) return null;
  return <aside className="absolute right-0 top-14 bottom-0 z-30 w-[min(360px,100vw)] overflow-y-auto border-l border-border bg-panel p-4 shadow-2xl" aria-label="Team members"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Team directory</p><h2 className="text-lg font-semibold text-foreground">Members</h2></div><div className="flex items-center gap-1"><button onClick={() => void refresh()} className="rounded-md p-2 text-muted hover:bg-surface hover:text-foreground" aria-label="Refresh members"><RefreshCw className="h-4 w-4" /></button><button onClick={() => setOpen(false)} className="rounded-md p-2 text-muted hover:bg-surface hover:text-foreground" aria-label="Close members"><X className="h-4 w-4" /></button></div></div><button onClick={() => void createInvite()} disabled={busy || !workspaceId} className="mb-3 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><Link2 className="h-4 w-4" />Invite people</button>{inviteUrl && <div className="mb-4 rounded-md border border-accent/30 bg-accent/10 p-2"><p className="break-all text-xs text-foreground">{inviteUrl}</p><button onClick={() => void navigator.clipboard?.writeText(inviteUrl)} className="mt-2 flex items-center gap-1 text-xs text-accent"><Copy className="h-3 w-3" />Copy link</button></div>}{error && <p role="alert" className="mb-3 rounded-md bg-red-500/10 p-2 text-xs text-red-400">{error}</p>}<div className="space-y-2">{members.map((member) => { const status = presence?.[member.userId] ?? member.status; return <div key={member.id} className="flex items-center gap-3 rounded-lg bg-surface p-3"><span className={`h-2 w-2 rounded-full ${status === "ONLINE" ? "bg-emerald-400" : status === "DND" ? "bg-red-400" : "bg-slate-500"}`} aria-label={status.toLowerCase()} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{member.displayName}</p><p className="truncate text-xs text-muted">{member.email}</p></div><span className="rounded bg-panel px-2 py-1 text-[10px] text-muted">{member.role}</span></div>; })}{!busy && members.length === 0 && <div className="py-8 text-center text-sm text-muted"><Users className="mx-auto mb-2 h-6 w-6" />No members yet — invite your first teammate</div>}</div><div className="mt-5 border-t border-border pt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Pending invites</p>{invites.filter((x) => x.status === "PENDING").map((invite) => <div key={invite.id} className="mb-2 rounded-md bg-surface p-2 text-xs text-muted">{invite.inviteeEmail ?? "Shareable link"}<br />{invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}</div>)}{invites.filter((x) => x.status === "PENDING").length === 0 && <p className="text-xs text-muted">No pending invites.</p>}</div></aside>;
}
