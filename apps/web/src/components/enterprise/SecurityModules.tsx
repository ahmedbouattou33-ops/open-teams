"use client";

import { useMemo, useState } from "react";
import { Activity, BrainCircuit, Phone, Plus, Search, Send, Trash2, Video } from "lucide-react";
import { SERVICES } from "@/lib/env";
import { audit, auditActions } from "@/lib/audit";
import { useAuthStore } from "@/stores/auth";
import { useEnterpriseStore } from "@/stores/enterprise";
import { useMessagesStore } from "@/stores/messages";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import { Badge, Card, GhostButton, LabeledInput, ModuleHeader, SelectInput, StatCard, TableShell } from "./ui";

interface ServiceHealth {
  readonly name: string;
  readonly url: string;
  readonly status: "checking" | "up" | "down";
}

export function WarRoomModule() {
  const tickets = useEnterpriseStore((s) => s.tickets);
  const startCall = useUiStore((s) => s.startCall);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const channelsByWorkspace = useWorkspaceStore((s) => s.channelsByWorkspace);
  const activeChannelId = useWorkspaceStore((s) => s.activeChannelId);
  const messagesByChannel = useMessagesStore((s) => s.messagesByChannel);

  const [health, setHealth] = useState<readonly ServiceHealth[]>([
    { name: "mcp-auth-workspace", url: SERVICES.auth, status: "checking" },
    { name: "mcp-messaging", url: SERVICES.messaging, status: "checking" },
    { name: "mcp-media-rtc", url: SERVICES.mediaRtc, status: "checking" },
    { name: "mcp-storage (MinIO)", url: SERVICES.storage, status: "checking" },
  ]);

  const criticalTickets = tickets.filter(
    (t) => t.priority === "CRITICAL" && t.status !== "RESOLVED",
  );

  const actionItems = useMemo(() => {
    const channel = activeChannelId ? messagesByChannel[activeChannelId] : undefined;
    return (channel ?? []).filter((message) => message.tag === "ACTION_ITEM").slice(-8).reverse();
  }, [messagesByChannel, activeChannelId]);

  function pingServices(): void {
    setHealth((current) => current.map((h) => ({ ...h, status: "checking" as const })));
    health.forEach(async (service) => {
      try {
        const res = await fetch(`${service.url}/health`, { signal: AbortSignal.timeout(3_000) });
        setHealth((current) =>
          current.map((h) =>
            h.url === service.url ? { ...h, status: res.ok ? ("up" as const) : ("down" as const) } : h,
          ),
        );
      } catch {
        setHealth((current) =>
          current.map((h) => (h.url === service.url ? { ...h, status: "down" as const } : h)),
        );
      }
    });
  }

  function launchCall(callType: "AUDIO" | "VIDEO"): void {
    const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
    const channel = (activeWorkspaceId ? channelsByWorkspace[activeWorkspaceId] : undefined)?.find(
      (c) => c.id === activeChannelId,
    );
    if (!workspace || !channel) return;
    startCall({
      workspaceId: workspace.id,
      channelId: channel.id,
      channelName: `war-room-${channel.name}`,
      callType,
    });
  }

  return (
    <div>
      <ModuleHeader
        title="Incident War Room"
        description="One-click emergency mode: live service health, urgent action items, critical tickets and instant WebRTC escalation in a unified dashboard."
        actions={
          <>
            <button type="button" onClick={() => launchCall("AUDIO")} className="btn-primary py-1.5 text-xs">
              <Phone className="h-3.5 w-3.5" /> Voice war room
            </button>
            <button type="button" onClick={() => launchCall("VIDEO")} className="btn-primary py-1.5 text-xs">
              <Video className="h-3.5 w-3.5" /> Video war room
            </button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Service health (on-prem)">
          <ul className="space-y-2">
            {health.map((service) => (
              <li key={service.url} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{service.name}</span>
                <span
                  className={`flex items-center gap-1.5 font-mono text-xs ${
                    service.status === "up"
                      ? "text-emerald-400"
                      : service.status === "down"
                        ? "text-rose-400"
                        : "text-slate-500"
                  }`}
                >
                  <Activity className="h-3 w-3" />
                  {service.status === "up" ? "UP" : service.status === "down" ? "DOWN" : "…"}
                </span>
              </li>
            ))}
          </ul>
          <GhostButton onClick={pingServices}>Re-check now</GhostButton>
        </Card>

        <Card title={`Urgent action items (${actionItems.length})`}>
          <ul className="space-y-1.5">
            {actionItems.map((message) => (
              <li key={message.id} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
                {message.content.type === "plain"
                  ? message.content.body.slice(0, 140)
                  : "[encrypted action item]"}
              </li>
            ))}
            {actionItems.length === 0 ? (
              <li className="text-xs text-slate-500">No ACTION_ITEM-tagged messages in the active channel.</li>
            ) : null}
          </ul>
        </Card>

        <Card title={`Critical tickets (${criticalTickets.length})`}>
          <ul className="space-y-1.5">
            {criticalTickets.map((ticket) => (
              <li key={ticket.id} className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5">
                <span className="text-xs font-semibold text-rose-200">{ticket.ref} · {ticket.title}</span>
                <Badge label={ticket.status} />
              </li>
            ))}
            {criticalTickets.length === 0 ? (
              <li className="text-xs text-slate-500">No unresolved critical tickets.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

interface KnowledgeHit {
  readonly docTitle: string;
  readonly passage: string;
  readonly score: number;
}

function retrieve(query: string, docs: readonly { title: string; content: string }[]): KnowledgeHit[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-zàâäéèêëîïôöùûüçñ0-9]+/)
    .filter((token) => token.length > 2);
  if (tokens.length === 0) return [];

  const hits: KnowledgeHit[] = [];
  for (const doc of docs) {
    const paragraphs = doc.content.split(/\n\s*\n|(?<=\.)\s{2,}/).filter((p) => p.trim().length > 40);
    for (const paragraph of paragraphs) {
      const lower = paragraph.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        const matches = lower.split(token).length - 1;
        score += matches * (1 / token.length);
      }
      if (score > 0) hits.push({ docTitle: doc.title, passage: paragraph.trim(), score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 4);
}

export function KnowledgeModule() {
  const docs = useEnterpriseStore((s) => s.knowledgeDocs);
  const addDoc = useEnterpriseStore((s) => s.addKnowledgeDoc);
  const removeDoc = useEnterpriseStore((s) => s.removeKnowledgeDoc);
  const user = useAuthStore((s) => s.user?.displayName ?? "");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const hits = useMemo(
    () => (question.trim().length > 2 ? retrieve(question, docs) : []),
    [question, docs],
  );

  function ingest(): void {
    if (!title.trim() || !content.trim()) return;
    addDoc({ title, content });
    audit("knowledge.doc.ingested", { target: title, details: `${content.length} chars indexed on-prem` });
    setTitle("");
    setContent("");
    setAnswer(`Indexed "${title}". The retrieval corpus now contains ${docs.length + 1} document(s).`);
  }

  return (
    <div>
      <ModuleHeader
        title="Corporate RAG Knowledge Assistant"
        description="On-premises retrieval over vault documents and company policies — nothing leaves this deployment. Retrieval is fully local; LLM synthesis hooks are reserved for mcp-ai-agent (Phase 6 semantic_search)."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card title="Ask the corpus">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. What is the data-retention policy?"
                  className="input-dark py-2 pl-9 text-sm"
                />
              </div>
              <button type="button" onClick={() => setAnswer(null)} className="btn-primary py-2 text-xs" title="Search">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>

            {hits.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {hits.map((hit, index) => (
                  <li key={index} className="rounded-xl border border-surface-border bg-black/20 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-300">
                      <BrainCircuit className="h-3 w-3" /> {hit.docTitle}
                      <span className="ml-auto font-normal normal-case text-slate-600">relevance {hit.score.toFixed(1)}</span>
                    </p>
                    <p className="text-xs leading-relaxed text-slate-300">{hit.passage}</p>
                  </li>
                ))}
              </ul>
            ) : question.trim().length > 2 ? (
              <p className="mt-3 text-xs text-slate-500">No relevant passages found in the indexed corpus.</p>
            ) : null}
            {answer ? <p className="mt-3 text-xs text-emerald-400">{answer}</p> : null}
          </Card>

          <Card title="Ingest policy / vault document">
            <div className="space-y-3">
              <LabeledInput label="Title" value={title} onChange={setTitle} placeholder="Security Policy v3" required />
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Content</span>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="w-full resize-none rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200 focus:border-accent focus:outline-none"
                  placeholder="Paste policy text, runbooks or compliance documentation…"
                />
              </label>
              <button type="button" onClick={ingest} disabled={!title || !content} className="btn-primary w-full py-1.5 text-xs">
                Index document ({user ? `curator: ${user}` : "local curator"})
              </button>
            </div>
          </Card>
        </div>

        <Card title={`Indexed corpus (${docs.length})`}>
          <ul className="space-y-2">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-start justify-between gap-2 rounded-xl border border-surface-border bg-surface p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{doc.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {(doc.content.length / 1024).toFixed(1)} KB · indexed {new Date(doc.addedAt).toLocaleDateString()}
                  </p>
                </div>
                <GhostButton danger onClick={() => removeDoc(doc.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </GhostButton>
              </li>
            ))}
            {docs.length === 0 ? (
              <li className="text-xs text-slate-500">No documents indexed yet.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function VersionsModule() {
  const versions = useEnterpriseStore((s) => s.versions);
  const addVersion = useEnterpriseStore((s) => s.addVersion);
  const stamps = useEnterpriseStore((s) => s.stamps);

  const [entityType, setEntityType] = useState<"FILE" | "MESSAGE" | "DOCUMENT">("DOCUMENT");
  const [label, setLabel] = useState("");
  const [summary, setSummary] = useState("");

  function submit(): void {
    if (!label.trim()) return;
    addVersion({ entityType, label, summary });
    audit("version.snapshot.saved", { target: label });
    setLabel("");
    setSummary("");
  }

  return (
    <div>
      <ModuleHeader
        title="Version History & Change Logs"
        description="Immutable change-log snapshots for files, documents and critical messages. Cryptographic seals from the Digital Stamping module appear alongside their version entries."
      />

      <Card title="Record a version snapshot">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectInput
            label="Entity type"
            value={entityType}
            onChange={setEntityType}
            options={[
              { value: "DOCUMENT", label: "Document" },
              { value: "FILE", label: "Vault file" },
              { value: "MESSAGE", label: "Critical message" },
            ]}
          />
          <LabeledInput label="Reference / name" value={label} onChange={setLabel} placeholder="Contract-ACME-v2.pdf" required />
          <LabeledInput label="Change summary" value={summary} onChange={setSummary} placeholder="Clause 7 renegotiated" />
          <button type="button" onClick={submit} className="btn-primary h-[34px] py-1 text-xs">
            <Plus className="h-3.5 w-3.5" /> Snapshot
          </button>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TableShell headers={["Entity", "Type", "Change", "Saved", ""]} isEmpty={versions.length === 0} empty="No version entries yet.">
            {versions.map((entry) => (
              <tr key={entry.id} className="hover:bg-surface-hover/40">
                <td className="px-3 py-2 font-medium text-white">{entry.label}</td>
                <td className="px-3 py-2"><Badge label={entry.entityType} /></td>
                <td className="px-3 py-2 text-xs text-slate-400">{entry.summary || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                  {new Date(entry.savedAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs font-mono text-slate-600">{entry.id.slice(0, 8)}</td>
              </tr>
            ))}
          </TableShell>
        </div>

        <Card title={`Linked official seals (${stamps.length})`}>
          <ul className="space-y-2">
            {stamps.map((stamp) => (
              <li key={stamp.id} className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2">
                <p className="truncate text-xs font-semibold text-indigo-200">{stamp.fileName}</p>
                <p className="font-mono text-[10px] text-slate-400">{stamp.sha256.slice(0, 20)}…</p>
              </li>
            ))}
            {stamps.length === 0 ? <li className="text-xs text-slate-500">No seals registered.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function SimulationsModule() {
  const campaigns = useEnterpriseStore((s) => s.simulations);
  const addCampaign = useEnterpriseStore((s) => s.addSimulation);
  const updateTarget = useEnterpriseStore((s) => s.updateSimulationTarget);

  const [name, setName] = useState("");
  const [template, setTemplate] = useState<"GIFT_CARD" | "CREDENTIALS" | "INVOICE_FRAUD" | "CEO_FRAUD">("CREDENTIALS");
  const [emails, setEmails] = useState("");

  function submit(): void {
    const targets = emails
      .split(/[,\n;]/)
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email) => ({ email, clicked: false, reported: false }));
    if (!name.trim() || targets.length === 0) return;
    addCampaign({ name, template, targets });
    audit(auditActions.simulationCreate, {
      severity: "WARNING",
      target: name,
      details: `${targets.length} targets enrolled in ${template} simulation`,
    });
    setName("");
    setEmails("");
  }

  function awarenessScore(clicked: number, reported: number): number {
    const total = clicked + reported;
    if (total === 0) return 100;
    return Math.round((reported / total) * 100);
  }

  return (
    <div>
      <ModuleHeader
        title="Phishing & Security Simulation"
        description="Plan social-engineering drills and record outcomes to measure employee awareness. Results feed security training programs — no emails leave the platform during planning."
      />

      <Card title="New campaign">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LabeledInput label="Campaign name" value={name} onChange={setName} placeholder="Q3 finance drill" required />
          <SelectInput
            label="Template"
            value={template}
            onChange={setTemplate}
            options={[
              { value: "CREDENTIALS", label: "Fake SSO login page" },
              { value: "GIFT_CARD", label: "Gift-card scam" },
              { value: "INVOICE_FRAUD", label: "Invoice fraud" },
              { value: "CEO_FRAUD", label: "Executive impersonation" },
            ]}
          />
          <div className="lg:col-span-2">
            <LabeledInput label="Targets (comma-separated emails)" value={emails} onChange={setEmails} placeholder="alice@corp.local, bob@corp.local" required />
          </div>
        </div>
        <button type="button" onClick={submit} className="btn-primary mt-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Launch drill
        </button>
      </Card>

      <div className="mt-4 space-y-4">
        {campaigns.map((campaign) => {
          const clicked = campaign.targets.filter((t) => t.clicked).length;
          const reported = campaign.targets.filter((t) => t.reported).length;
          return (
            <Card key={campaign.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">{campaign.name}</p>
                  <p className="text-xs text-slate-500">
                    Template: {campaign.template} · launched {new Date(campaign.createdAt).toLocaleDateString()} · {campaign.targets.length} targets
                  </p>
                </div>
                <StatCard label="Awareness score" value={`${awarenessScore(clicked, reported)}%`} tone={awarenessScore(clicked, reported) >= 70 ? "good" : "warn"} />
              </div>
              <TableShell headers={["Target", "Clicked", "Reported"]} isEmpty={campaign.targets.length === 0}>
                {campaign.targets.map((target) => (
                  <tr key={target.email} className="hover:bg-surface-hover/40">
                    <td className="px-3 py-2 text-slate-300">{target.email}</td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={target.clicked}
                        onChange={(e) => updateTarget(campaign.id, target.email, { clicked: e.target.checked })}
                        className="h-4 w-4 accent-rose-500"
                        aria-label={`${target.email} clicked`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={target.reported}
                        onChange={(e) => updateTarget(campaign.id, target.email, { reported: e.target.checked })}
                        className="h-4 w-4 accent-emerald-500"
                        aria-label={`${target.email} reported`}
                      />
                    </td>
                  </tr>
                ))}
              </TableShell>
            </Card>
          );
        })}
        {campaigns.length === 0 ? <p className="text-sm text-slate-500">No simulations yet.</p> : null}
      </div>
    </div>
  );
}
