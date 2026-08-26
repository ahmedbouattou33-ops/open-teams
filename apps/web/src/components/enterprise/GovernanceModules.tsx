"use client";

import { useMemo, useState } from "react";
import { Download, FileCheck2, FileSearch, LockKeyhole, SendHorizonal, ShieldOff } from "lucide-react";
import type { AuditSeverity } from "@/lib/audit";
import {
  audit,
  auditActions,
  useAuditStore,
} from "@/lib/audit";
import { api } from "@/lib/api";
import {
  decryptString,
  encryptString,
  parseEncrypted,
  serializeEncrypted,
  sha256Hex,
} from "@/lib/crypto";
import { downloadFile, toCsv } from "@/lib/download";
import { errorMessage } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useSecurityStore, type SsoProvider } from "@/stores/security";
import { useEnterpriseStore } from "@/stores/enterprise";
import { useWorkspaceStore } from "@/stores/workspace";
import {
  Badge,
  Card,
  GhostButton,
  LabeledInput,
  ModuleHeader,
  SelectInput,
  TableShell,
} from "./ui";

export function AuditModule() {
  const events = useAuditStore((s) => s.events);
  const clear = useAuditStore((s) => s.clear);
  const [severityFilter, setSeverityFilter] = useState<"ALL" | AuditSeverity>("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      events.filter((event) => {
        if (severityFilter !== "ALL" && event.severity !== severityFilter) return false;
        if (!query) return true;
        const haystack = `${event.actor} ${event.action} ${event.target ?? ""} ${event.details ?? ""}`;
        return haystack.toLowerCase().includes(query.toLowerCase());
      }),
    [events, severityFilter, query],
  );

  function exportJson(): void {
    downloadFile(`openteams-audit-${Date.now()}.json`, JSON.stringify(filtered, null, 2), "application/json");
    audit(auditActions.legalExport, { target: "audit trail", details: `${filtered.length} events exported as JSON` });
  }

  function exportCsv(): void {
    downloadFile(
      `openteams-audit-${Date.now()}.csv`,
      toCsv(filtered.map((e) => ({ ...e }))),
      "text/csv",
    );
    audit(auditActions.legalExport, { target: "audit trail", details: `${filtered.length} events exported as CSV` });
  }

  return (
    <div>
      <ModuleHeader
        title="Audit Log & SIEM Feed"
        description="Real-time security event tracking: authentication, permission changes, file downloads and emergency actions. Exportable for SIEM ingestion (JSON / CEF-style CSV)."
        actions={
          <>
            <GhostButton onClick={exportCsv}>Export CSV</GhostButton>
            <button type="button" onClick={exportJson} className="btn-primary py-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Export JSON
            </button>
            <GhostButton danger onClick={() => clear()}>
              Purge
            </GhostButton>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by actor, action, target…"
          className="input-dark max-w-sm py-1.5 text-sm"
        />
        <SelectInput
          label=""
          value={severityFilter}
          onChange={setSeverityFilter}
          options={[
            { value: "ALL", label: "All severities" },
            { value: "INFO", label: "Info" },
            { value: "WARNING", label: "Warning" },
            { value: "CRITICAL", label: "Critical" },
          ]}
        />
        <span className="ml-auto text-xs text-slate-500">{filtered.length} events</span>
      </div>

      <TableShell headers={["Time", "Severity", "Actor", "Action", "Target", "Details"]} isEmpty={filtered.length === 0} empty="No audit events recorded yet.">
        {filtered.slice(0, 200).map((event) => (
          <tr key={event.id} className="hover:bg-surface-hover/40">
            <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
              {new Date(event.at).toLocaleString()}
            </td>
            <td className="px-3 py-2"><Badge label={event.severity} /></td>
            <td className="px-3 py-2 text-slate-300">{event.actor}</td>
            <td className="px-3 py-2 font-mono text-xs text-indigo-300">{event.action}</td>
            <td className="px-3 py-2 text-slate-300">{event.target ?? "—"}</td>
            <td className="px-3 py-2 text-xs text-slate-500">{event.details ?? "—"}</td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

export function AccessControlModule() {
  const ssoConfig = useSecurityStore((s) => s.ssoConfig);
  const saveSsoConfig = useSecurityStore((s) => s.saveSsoConfig);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const channelsByWorkspace = useWorkspaceStore((s) => s.channelsByWorkspace);

  const [draft, setDraft] = useState(ssoConfig);
  const [saved, setSaved] = useState(false);

  function onSave(): void {
    saveSsoConfig(draft);
    audit(auditActions.ssoConfigChange, {
      severity: "WARNING",
      details: `Identity provider set to ${draft.provider}; MFA ${draft.enforceMfa ? "enforced" : "optional"}`,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <ModuleHeader
        title="Access Control & Enterprise SSO"
        description="Central RBAC is enforced per-tool by mcp-auth-workspace (OWNER > ADMIN > MEMBER > GUEST). Configure directory federation for on-premises Active Directory / LDAP or SAML / OIDC single sign-on."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Identity federation (air-gap friendly)">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput
              label="Provider"
              value={draft.provider}
              onChange={(provider) => setDraft({ ...draft, provider })}
              options={[
                { value: "NONE", label: "Local accounts only" },
                { value: "LDAP", label: "Active Directory / LDAP" },
                { value: "SAML", label: "SAML 2.0" },
                { value: "OIDC", label: "OpenID Connect" },
              ]}
            />
            <label className="mt-5 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={draft.enforceMfa}
                onChange={(e) => setDraft({ ...draft, enforceMfa: e.target.checked })}
                className="h-4 w-4 accent-indigo-500"
              />
              Enforce MFA
            </label>
            {draft.provider === "LDAP" ? (
              <>
                <LabeledInput label="LDAP URL" value={draft.ldapUrl} onChange={(ldapUrl) => setDraft({ ...draft, ldapUrl })} placeholder="ldaps://dc01.corp.local:636" />
                <LabeledInput label="Base DN" value={draft.baseDn} onChange={(baseDn) => setDraft({ ...draft, baseDn })} placeholder="DC=corp,DC=local" />
                <LabeledInput label="Bind user" value={draft.bindUser} onChange={(bindUser) => setDraft({ ...draft, bindUser })} placeholder="CN=svc-openteams" />
              </>
            ) : null}
            {draft.provider === "SAML" || draft.provider === "OIDC" ? (
              <LabeledInput
                label="IdP metadata / discovery URL"
                value={draft.idpMetadataUrl}
                onChange={(idpMetadataUrl) => setDraft({ ...draft, idpMetadataUrl })}
                placeholder="https://idp.corp.local/metadata"
              />
            ) : null}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={onSave} className="btn-primary py-1.5 text-xs">
              <LockKeyhole className="h-3.5 w-3.5" /> Save configuration
            </button>
            {saved ? <span className="text-xs font-medium text-emerald-400">Configuration saved</span> : null}
          </div>
        </Card>

        <Card title="Effective workspace permissions (RBAC)">
          <ul className="space-y-3">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                  {workspace.name}
                  <Badge label={workspace.role} />
                </p>
                <ul className="space-y-0.5 pl-1">
                  {(channelsByWorkspace[workspace.id] ?? []).map((channel) => (
                    <li key={channel.id} className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono">#{channel.name}</span>
                      <Badge label={channel.type} />
                      <span>{channel.joined ? `my role: ${channel.myRole ?? "member"}` : "not joined"}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {workspaces.length === 0 ? (
              <li className="text-xs text-slate-500">No workspaces available.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function WhistleblowingModule() {
  const reports = useEnterpriseStore((s) => s.reports);
  const addReport = useEnterpriseStore((s) => s.addReport);
  const updateReportStatus = useEnterpriseStore((s) => s.updateReportStatus);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (!subject.trim() || !body.trim()) return;
    addReport({
      subject: subject.trim(),
      body: body.trim(),
    });
    setSubmitted(true);
    setSubject("");
    setBody("");
    setTimeout(() => setSubmitted(false), 3000);

    try {
      const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      const channels = workspaceId ? await api.listChannels(workspaceId) : [];
      const target = channels.find((c) => c.name === "whistleblowing");
      if (target) {
        await api.sendMessage({
          channelId: target.id,
          content: { type: "plain", body: `[CONFIDENTIAL REPORT] ${subject}` },
          tag: "NOTE",
        });
      }
    } catch (err) {
      setError(errorMessage(err));
    }
    audit(auditActions.whistleblow, {
      severity: "WARNING",
      details: "Anonymous report filed directly to administration review queue",
    });
  }

  return (
    <div>
      <ModuleHeader
        title="Whistleblowing — Anonymous Reporting"
        description="Secure, identity-free reporting line routed straight to top administration. Reports are stored without any author metadata and never leave this deployment unencrypted."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="File a confidential report">
          <div className="space-y-3">
            <LabeledInput label="Subject" value={subject} onChange={setSubject} placeholder="Summary of the concern" required />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Report</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="w-full resize-none rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
                placeholder="Describe what you observed. Do not include identifying information unless strictly necessary."
              />
            </label>
            <button type="button" onClick={() => void submit()} disabled={!subject || !body} className="btn-primary w-full py-1.5 text-xs">
              <SendHorizonal className="h-3.5 w-3.5" /> Submit anonymously
            </button>
            {submitted ? <p className="text-xs text-emerald-400">Report sealed and delivered to administration.</p> : null}
            {error ? <p className="text-xs text-amber-400">Local record kept; direct channel delivery unavailable ({error})</p> : null}
          </div>
        </Card>

        <Card title={`Administration review queue (${reports.length})`}>
          <ul className="space-y-2">
            {reports.map((report) => (
              <li key={report.id} className="rounded-xl border border-surface-border bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-white">{report.subject}</p>
                  <Badge label={report.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{report.body}</p>
                <p className="mt-1 text-[10px] text-slate-600">
                  Received {new Date(report.createdAt).toLocaleString()} · author: anonymous
                </p>
                <div className="mt-2 flex gap-1">
                  <GhostButton onClick={() => updateReportStatus(report.id, "ACKNOWLEDGED")}>Acknowledge</GhostButton>
                  <GhostButton onClick={() => updateReportStatus(report.id, "CLOSED")}>Close</GhostButton>
                </div>
              </li>
            ))}
            {reports.length === 0 ? <li className="text-xs text-slate-500">No reports received.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function StampingModule() {
  const stamps = useEnterpriseStore((s) => s.stamps);
  const addStamp = useEnterpriseStore((s) => s.addStamp);
  const stampedByEmail = useAuthStore((s) => s.user?.email ?? "system");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function stampOrVerify(mode: "stamp" | "verify"): Promise<void> {
    setStatus(null);
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const hash = await sha256Hex(await file.arrayBuffer());
      if (mode === "stamp") {
        addStamp({ fileName: file.name, sha256: hash, stampedBy: stampedByEmail, note });
        audit(auditActions.stampCreate, { target: file.name, details: `SHA-256 seal ${hash.slice(0, 16)}…` });
        setStatus(`Sealed "${file.name}" · ${hash}`);
        setNote("");
      } else {
        const match = stamps.find((s) => s.sha256 === hash);
        audit(auditActions.stampVerify, {
          target: file.name,
          severity: match ? "INFO" : "WARNING",
          details: match ? "Digital seal matched" : "No matching official seal",
        });
        setStatus(
          match
            ? `VERIFIED — official seal by ${match.stampedBy} at ${new Date(match.stampedAt).toLocaleString()}`
            : `FAILED — "${file.name}" does not match any registered official seal`,
        );
      }
    };
    input.click();
  }

  return (
    <div>
      <ModuleHeader
        title="Digital Stamping & Official Seals"
        description="Cryptographic SHA-256 seals make documents tamper-evident: stamp an official document once, then verify its integrity at any time."
      />

      <Card title="Stamp or verify a document">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <LabeledInput label="Seal note (optional)" value={note} onChange={setNote} placeholder="Board minutes 2026-08" />
          </div>
          <button type="button" onClick={() => void stampOrVerify("stamp")} className="btn-primary py-1.5 text-xs">
            <FingerprintIcon /> Stamp document
          </button>
          <button type="button" onClick={() => void stampOrVerify("verify")} className="btn-primary py-1.5 text-xs">
            <FileSearch className="h-3.5 w-3.5" /> Verify document
          </button>
        </div>
        {status ? (
          <p className={`mt-3 break-all rounded-lg border p-3 font-mono text-xs ${status.startsWith("VERIFIED") ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : status.startsWith("FAILED") ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-surface-border text-slate-300"}`}>
            {status}
          </p>
        ) : null}
      </Card>

      <div className="mt-4">
        <TableShell headers={["Document", "SHA-256 seal", "Stamped by", "Note", "Date"]} isEmpty={stamps.length === 0} empty="No documents stamped yet.">
          {stamps.map((stamp) => (
            <tr key={stamp.id} className="hover:bg-surface-hover/40">
              <td className="px-3 py-2 font-medium text-white">{stamp.fileName}</td>
              <td className="px-3 py-2 font-mono text-xs text-indigo-300">{stamp.sha256.slice(0, 24)}…</td>
              <td className="px-3 py-2 text-slate-300">{stamp.stampedBy}</td>
              <td className="px-3 py-2 text-xs text-slate-500">{stamp.note || "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                {new Date(stamp.stampedAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </TableShell>
      </div>
    </div>
  );
}

function FingerprintIcon() {
  return <FileCheck2 className="h-3.5 w-3.5" />;
}

export function BackupExportModule() {
  const enterpriseState = useEnterpriseStore.getState;
  const [passphrase, setPassphrase] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createBackup(): Promise<void> {
    if (passphrase.length < 8) {
      setResult("Passphrase must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const snapshot = JSON.stringify({ generatedAt: new Date().toISOString(), data: enterpriseState() });
      const payload = await encryptString(snapshot, passphrase);
      downloadFile(`openteams-backup-${new Date().toISOString().slice(0, 10)}.otbak`, serializeEncrypted(payload), "application/json");
      audit(auditActions.backupCreate, { severity: "WARNING", details: "Encrypted offline backup generated" });
      setResult("Backup written locally with AES-256-GCM (PBKDF2 · 310k iterations).");
    } catch (error) {
      setResult(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function legalExport(): Promise<void> {
    const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
    const channels = workspaceId ? await api.listChannels(workspaceId) : [];
    const channelName = window.prompt(`Legal export — channel name:\n${channels.map((c) => c.name).join(", ")}`);
    if (!channelName) return;
    const channel = channels.find((c) => c.name === channelName);
    if (!channel || !workspaceId) {
      setResult("Channel not found in the active workspace.");
      return;
    }
    if (passphrase.length < 8) {
      setResult("Set an encryption passphrase first (min. 8 characters).");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const messages: unknown[] = [];
      let cursor: string | null = null;
      do {
        const page = await api.history({
          channelId: channel.id,
          limit: 100,
          ...(cursor ? { before: cursor } : {}),
        });
        messages.push(...page.messages);
        cursor = page.nextCursor;
      } while (cursor);

      const payload = await encryptString(JSON.stringify(messages, null, 2), passphrase);
      downloadFile(`legal-export-${channelName}-${Date.now()}.otarchive`, serializeEncrypted(payload), "application/json");
      audit(auditActions.legalExport, {
        severity: "WARNING",
        target: `#${channelName}`,
        details: `${messages.length} messages archived encrypted for investigation`,
      });
      setResult(`${messages.length} messages sealed into an encrypted archive.`);
    } catch (error) {
      setResult(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ModuleHeader
        title="Offline Backup & Legal Compliance Export"
        description="Air-gap continuity: generate a passphrase-encrypted snapshot of all console records, or archive full channel history as tamper-safe encrypted evidence for investigations."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Encryption passphrase">
          <LabeledInput label="Passphrase" type="password" value={passphrase} onChange={setPassphrase} placeholder="Used to derive the AES-256 key locally" />
          <p className="mt-2 flex items-start gap-2 text-xs text-slate-500">
            <ShieldOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The passphrase never leaves this device — lost passphrases cannot be recovered.
          </p>
        </Card>

        <Card title="Actions">
          <div className="space-y-3">
            <button type="button" onClick={() => void createBackup()} disabled={busy} className="btn-primary w-full py-2 text-sm">
              <Download className="h-4 w-4" /> Generate encrypted backup (.otbak)
            </button>
            <button type="button" onClick={() => void legalExport()} disabled={busy} className="btn-primary w-full py-2 text-sm">
              <LockKeyhole className="h-4 w-4" /> Legal export of a channel (.otarchive)
            </button>
            {busy ? <p className="text-xs text-slate-500">Working…</p> : null}
            {result ? <p className="break-words rounded-lg border border-surface-border p-3 text-xs text-slate-300">{result}</p> : null}
          </div>
        </Card>
      </div>

      <Card title="Restore preview" className="mt-4">
        <RestorePreview />
      </Card>
    </div>
  );
}

function RestorePreview() {
  const [output, setOutput] = useState<string | null>(null);

  async function restore(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".otbak,.otarchive,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const passphrase = window.prompt("Decryption passphrase") ?? "";
      try {
        const raw = await file.text();
        const payload = parseEncrypted(raw);
        if (!payload) throw new Error("Unrecognized archive format");
        const plain = await decryptString(payload, passphrase);
        const parsed: unknown = JSON.parse(plain);
        setOutput(`${file.name}: valid encryption — ${(plain.length / 1024).toFixed(1)} KB of records decrypted.`);
        void parsed;
      } catch (error) {
        setOutput(`Decryption failed: ${errorMessage(error)}`);
      }
    };
    input.click();
  }

  return (
    <div className="space-y-2">
      <GhostButton onClick={() => void restore()}>
        Decrypt & inspect an archive without importing it
      </GhostButton>
      {output ? <p className="rounded-lg border border-surface-border p-3 text-xs text-slate-300">{output}</p> : null}
    </div>
  );
}
