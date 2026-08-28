"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Server,
  Wifi,
  WifiOff,
  CalendarDays,
  CheckSquare,
  FileText,
  Hash,
  ListChecks,
  MessageSquare,
  Phone,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import type { AgendaEventDTO, WorkTaskDTO } from "@openteams/shared-types";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import { cn } from "@/lib/utils";

export default function DashboardPanel() {
  const user = useAuthStore((state) => state.user);
  const setDashboardOpen = useUiStore((state) => state.setDashboardOpen);
  const setProfileOpen = useUiStore((state) => state.setProfileOpen);
  const setFilesDrawerOpen = useUiStore((state) => state.setFilesDrawerOpen);
  const setMembersOpen = useUiStore((state) => state.setMembersOpen);
  const setAgendaOpen = useUiStore((state) => state.setAgendaOpen);
  const setWorkPlanOpen = useUiStore((state) => state.setWorkPlanOpen);
  const startCall = useUiStore((state) => state.startCall);
  const realtimeConnected = useUiStore((state) => state.realtimeConnected);
  const setActiveChannel = useWorkspaceStore((state) => state.setActiveChannel);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const channelsByWorkspace = useWorkspaceStore((state) => state.channelsByWorkspace);

  const workspace = workspaces.find((item) => item.id === activeWorkspaceId) ?? null;
  const channels = activeWorkspaceId ? channelsByWorkspace[activeWorkspaceId] ?? [] : [];
  const [tasks, setTasks] = useState<readonly WorkTaskDTO[]>([]);
  const [events, setEvents] = useState<readonly AgendaEventDTO[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [taggedMessages, setTaggedMessages] = useState<readonly import("@openteams/shared-types").MessageDTO[]>([]);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof api.adminHealth>> | null>(null);
  const [adminStats, setAdminStats] = useState<Awaited<ReturnType<typeof api.adminStats>> | null>(null);
  const [activity, setActivity] = useState<readonly Record<string, unknown>[]>([]);
  const [mentions, setMentions] = useState<readonly import("@openteams/shared-types").MessageDTO[]>([]);

  useEffect(() => {
    if (!activeWorkspaceId) { setTasks([]); setEvents([]); setTaggedMessages([]); setMentions([]); return; }
    let cancelled = false;
    setLoadingData(true);
    const joined = channels.filter((channel) => channel.joined);
    void Promise.all([
      api.listWorkTasks({ workspaceId: activeWorkspaceId }),
      api.listAgendaEvents({ workspaceId: activeWorkspaceId }),
      ...joined.flatMap((channel) => [api.history({ channelId: channel.id, tag: "ACTION_ITEM", limit: 50 }).then((page) => page.messages), api.history({ channelId: channel.id, tag: "DECISION", limit: 50 }).then((page) => page.messages)]),
    ]).then(async (results) => {
      if (cancelled) return;
      setTasks(results[0] as readonly WorkTaskDTO[]); setEvents(results[1] as readonly AgendaEventDTO[]);
      const tagged = results.slice(2).flat() as readonly import("@openteams/shared-types").MessageDTO[];
      setTaggedMessages(tagged);
      const identity = [user?.email, user?.displayName].filter(Boolean).map((value) => String(value).toLowerCase());
      const allMessages = (await Promise.all(joined.map((channel) => api.history({ channelId: channel.id, limit: 100 }).then((page) => page.messages).catch(() => [])))).flat();
      setMentions(allMessages.filter((message) => { const body = message.content.type === "plain" ? message.content.body.toLowerCase() : ""; return body.length > 0 && identity.some((value) => body.includes(`@${value}`)); }) as readonly import("@openteams/shared-types").MessageDTO[]);
    }).catch(() => { if (!cancelled) { setTasks([]); setEvents([]); setTaggedMessages([]); setMentions([]); } }).finally(() => { if (!cancelled) setLoadingData(false); });
    return () => { cancelled = true; };
  }, [activeWorkspaceId, channels, user?.email, user?.displayName]);

  useEffect(() => {
    if (!activeWorkspaceId || !["OWNER", "ADMIN"].includes(workspace?.role ?? "")) return;
    let cancelled = false;
    const loadAdmin = async () => {
      try {
        const [nextHealth, nextStats, nextLogs] = await Promise.all([api.adminHealth(activeWorkspaceId), api.adminStats(activeWorkspaceId), api.adminSiemLogs(activeWorkspaceId)]);
        if (!cancelled) { setHealth(nextHealth); setAdminStats(nextStats); setActivity(nextLogs.events); }
      } catch { if (!cancelled) { setHealth(null); setAdminStats(null); setActivity([]); } }
    };
    void loadAdmin(); const timer = window.setInterval(() => void loadAdmin(), 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeWorkspaceId, workspace?.role]);
  const openTasks = tasks.filter((task) => task.status !== "DONE");
  const nextEvents = [...events].filter((event) => new Date(event.endsAt).getTime() >= Date.now()).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()).slice(0, 3);
  const joinedChannels = channels.filter((channel) => channel.joined);
  const actionMessages = taggedMessages.filter((message) => message.tag === "ACTION_ITEM");
  const decisionMessages = taggedMessages.filter((message) => message.tag === "DECISION");
  const messageText = (message: import("@openteams/shared-types").MessageDTO) => message.content.type === "plain" ? message.content.body : "Encrypted message";
  const huddleChannel = joinedChannels[0];
  const openChannel = (channelId: string) => {
    setDashboardOpen(false);
    setActiveChannel(channelId);
  };

  return (
    <section className="fixed inset-0 z-50 overflow-y-auto bg-surface/95 backdrop-blur-sm" aria-label="Workspace dashboard">
      <div className="mx-auto min-h-full w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Workspace command center</p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{workspace?.name ?? "Your workspace"}</h1>
            <p className="mt-1 text-sm text-slate-400">A secure overview of collaboration, priorities and workspace activity.</p>
          </div>
          <button type="button" aria-label="Close dashboard" onClick={() => setDashboardOpen(false)} className="rounded-xl border border-surface-border p-2 text-slate-400 hover:bg-surface-hover hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<Hash className="h-4 w-4" />} label="Joined channels" value={String(joinedChannels.length)} detail="Accessible conversation spaces" />
          <MetricCard icon={realtimeConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />} label="Your status" value={realtimeConnected ? "ONLINE" : "OFFLINE"} detail={realtimeConnected ? "WebSocket presence is synchronized" : "Waiting for messaging service"} />
          <MetricCard icon={<ShieldCheck className="h-4 w-4" />} label="Security" value="E2EE ready" detail="Encrypted channels keep ciphertext on the server" />
          <MetricCard icon={<Activity className="h-4 w-4" />} label="Workspace role" value={workspace?.role ?? "MEMBER"} detail="Permissions are role-derived" />
          {health ? <MetricCard icon={<Server className="h-4 w-4" />} label="Infrastructure" value={`${health.services.filter((service) => service.status === "ONLINE").length}/${health.services.length} online`} detail={`${adminStats?.activeSessions ?? 0} active sessions · live probe`} /> : null}
        </div>
        {health?.telemetry ? <section className="mt-4 rounded-2xl border border-surface-border bg-surface-raised p-4"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Server className="h-4 w-4 text-accent" />System Infrastructure & Health</h2><span className="text-xs text-slate-500">sampled {new Date(health.telemetry.sampledAt).toLocaleTimeString()}</span></div><div className="grid gap-3 sm:grid-cols-3"><Telemetry label="CPU load (1m)" value={health.telemetry.cpuLoad1m.toFixed(2)} /><Telemetry label="RAM heap" value={`${Math.round(health.telemetry.heapUsedBytes / 1024 / 1024)} MB`} /><Telemetry label="WebSocket latency" value={`${health.telemetry.websocketLatencyMs} ms`} /></div></section> : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-surface-border bg-surface-raised p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white">Quick actions</h2>
                  <p className="mt-1 text-xs text-slate-500">Open the work surface you need without leaving the workspace.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ActionButton icon={<CalendarDays />} label="Agenda & meetings" onClick={() => { setDashboardOpen(false); setAgendaOpen(true); }} />
                <ActionButton icon={<FileText />} label="Personal notes" onClick={() => { setDashboardOpen(false); setAgendaOpen(true); }} />
                <ActionButton icon={<ListChecks />} label="Work plan" onClick={() => { setDashboardOpen(false); setWorkPlanOpen(true); }} />
                <ActionButton icon={<Users />} label="Workspace members" onClick={() => { setDashboardOpen(false); setMembersOpen(true); }} />
                <ActionButton icon={<FileText />} label="Secure file vault" onClick={() => { setDashboardOpen(false); setFilesDrawerOpen(true); }} />
                <ActionButton icon={<MessageSquare />} label="Open a channel" onClick={() => joinedChannels[0] && openChannel(joinedChannels[0].id)} />
                <ActionButton icon={<Phone />} label="Quick huddle" onClick={() => huddleChannel && startCall({ workspaceId: activeWorkspaceId ?? "", channelId: huddleChannel.id, channelName: huddleChannel.name, callType: "AUDIO" })} />
                <ActionButton icon={<ShieldCheck />} label="Review my profile" onClick={() => { setDashboardOpen(false); setProfileOpen(true); }} />
              </div>
            </section>

            <section className="rounded-2xl border border-surface-border bg-surface-raised p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-accent" /><h2 className="font-semibold text-white">@Mentions inbox</h2></div><span className="text-xs text-slate-500">{mentions.length} found</span></div>
              {mentions.length ? <div className="space-y-2">{mentions.slice(0, 5).map((message) => <div key={message.id} className="rounded-xl border border-surface-border bg-surface px-3 py-3"><p className="text-sm text-slate-200">{messageText(message)}</p><p className="mt-1 text-xs text-slate-500">{channels.find((channel) => channel.id === message.channelId)?.name ?? "channel"} · {new Date(message.createdAt).toLocaleString()}</p></div>)}</div> : <EmptyState title="No mentions" detail="Messages that mention your email or display name will appear here." />}
            </section>

            <section className="rounded-2xl border border-surface-border bg-surface-raised p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2"><CheckSquare className="h-4 w-4 text-accent" /><h2 className="font-semibold text-white">Action items</h2></div>
              {loadingData ? <p className="text-sm text-slate-500">Loading workspace priorities…</p> : openTasks.length || actionMessages.length ? <div className="space-y-2">{openTasks.slice(0, 3).map((task) => <button key={task.id} type="button" onClick={() => setDashboardOpen(false)} className="flex w-full items-center justify-between rounded-xl border border-surface-border bg-surface px-3 py-3 text-left hover:bg-surface-hover"><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-200">{task.title}</span><span className="text-xs text-slate-500">{task.status.replace("_", " ")} · {task.priority}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-slate-600" /></button>)}{actionMessages.slice(0, 3).map((message) => <div key={message.id} className="rounded-xl border border-surface-border bg-surface px-3 py-3"><p className="text-sm text-slate-200">{messageText(message)}</p><p className="mt-1 text-xs text-slate-500">ACTION_ITEM · {channels.find((channel) => channel.id === message.channelId)?.name ?? "channel"} · {message.assigneeId ? `assignee ${message.assigneeId}` : "unassigned"}</p></div>)}</div> : <EmptyState title="No unresolved action items" detail="Tagged ACTION_ITEM messages and work tasks will appear here when they are available." />}
            </section>

            <section className="rounded-2xl border border-surface-border bg-surface-raised p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /><h2 className="font-semibold text-white">Decisions</h2></div>
              {decisionMessages.length ? <div className="space-y-2">{decisionMessages.slice(0, 5).map((message) => <div key={message.id} className="rounded-xl border border-surface-border bg-surface px-3 py-3"><p className="text-sm text-slate-200">{messageText(message)}</p><p className="mt-1 text-xs text-slate-500">DECISION · {channels.find((channel) => channel.id === message.channelId)?.name ?? "channel"} · {new Date(message.createdAt).toLocaleString()}</p></div>)}</div> : <EmptyState title="No decisions recorded yet" detail="DECISION-tagged messages will be summarized here without exposing private channel content." />}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-surface-border bg-surface-raised p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-white">Upcoming agenda</h2><span className="text-xs text-slate-500">{nextEvents.length} next</span></div>
              <div className="space-y-2">{nextEvents.length ? nextEvents.map((event) => <div key={event.id} className="rounded-xl border border-surface-border bg-surface px-3 py-3"><p className="truncate text-sm font-medium text-slate-200">{event.title}</p><p className="mt-1 text-xs text-slate-500">{new Date(event.startsAt).toLocaleString()}</p></div>) : <EmptyState title="No upcoming meetings" detail="Private and shared agenda events will appear here when accessible." />}</div>
            </section>

            <section className="rounded-2xl border border-surface-border bg-surface-raised p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-white">Your channels</h2><span className="text-xs text-slate-500">{joinedChannels.length} joined</span></div>
              <div className="space-y-2">
                {joinedChannels.length ? joinedChannels.map((channel) => (
                  <button key={channel.id} type="button" onClick={() => openChannel(channel.id)} className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left text-sm text-slate-300 hover:border-surface-border hover:bg-surface-hover hover:text-white">
                    <Hash className="h-4 w-4 text-slate-500" /><span className="truncate">{channel.name}</span><ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-600" />
                  </button>
                )) : <EmptyState title="No channels yet" detail="Create or join a workspace channel to start collaborating." />}
              </div>
            </section>

            <section className="rounded-2xl border border-surface-border bg-surface-raised p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-accent" /><h2 className="font-semibold text-white">Activity feed</h2></div>
              {activity.length ? <div className="space-y-2">{activity.slice(0, 6).map((item, index) => <div key={index} className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-300">{String(item.event ?? item.type ?? "activity")} · {String(item.timestamp ?? "now")}</div>)}</div> : <EmptyState title="Activity is private by default" detail="Workspace activity will appear here only when your role and channel permissions allow it." />}
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Telemetry({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-surface p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-white">{value}</p></div>; }

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-surface-border bg-surface-raised p-4"><div className="flex items-center gap-2 text-accent">{icon}<span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span></div><p className="mt-3 truncate text-xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface px-3 py-3 text-left text-sm font-medium text-slate-200 transition-colors hover:border-accent/50 hover:bg-surface-hover hover:text-white">{React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "h-4 w-4 text-accent" })}<span className="truncate">{label}</span></button>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className={cn("rounded-xl border border-dashed border-surface-border px-4 py-5", "bg-surface/40")}><p className="text-sm font-medium text-slate-300">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>;
}

import React from "react";
