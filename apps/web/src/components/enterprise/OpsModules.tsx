"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import type { AssetCategory, AssetStatus, TicketPriority, TicketStatus } from "@/stores/enterprise";
import { auditActions } from "@/lib/audit";
import { audit } from "@/lib/audit";
import { useEnterpriseStore } from "@/stores/enterprise";
import {
  Badge,
  Card,
  GhostButton,
  LabeledInput,
  ModuleHeader,
  SelectInput,
  StatCard,
  TableShell,
} from "./ui";

export function AssetsModule() {
  const assets = useEnterpriseStore((s) => s.assets);
  const addAsset = useEnterpriseStore((s) => s.addAsset);
  const updateAssetStatus = useEnterpriseStore((s) => s.updateAssetStatus);
  const removeAsset = useEnterpriseStore((s) => s.removeAsset);
  const [draft, setDraft] = useState({
    name: "",
    category: "LAPTOP" as AssetCategory,
    serial: "",
    assignedTo: "",
    purchaseDate: "",
  });

  function submit(): void {
    if (!draft.name.trim()) return;
    addAsset({ ...draft, status: draft.assignedTo ? "ASSIGNED" : "IN_STOCK" });
    setDraft({ name: "", category: "LAPTOP", serial: "", assignedTo: "", purchaseDate: "" });
  }

  return (
    <div>
      <ModuleHeader
        title="IT Asset Management"
        description="Track hardware, devices and FIDO/security keys across their lifecycle — procurement, assignment, maintenance and retirement."
      />

      <Card title="Register asset">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <LabeledInput label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} placeholder="ThinkPad X1 #042" required />
          <SelectInput
            label="Category"
            value={draft.category}
            onChange={(category) => setDraft({ ...draft, category })}
            options={[
              { value: "LAPTOP", label: "Laptop" },
              { value: "PHONE", label: "Phone" },
              { value: "SERVER", label: "Server" },
              { value: "SECURITY_KEY", label: "Security key" },
              { value: "OTHER", label: "Other" },
            ]}
          />
          <LabeledInput label="Serial" value={draft.serial} onChange={(serial) => setDraft({ ...draft, serial })} placeholder="SN-XXXX" />
          <LabeledInput label="Assigned to" value={draft.assignedTo} onChange={(assignedTo) => setDraft({ ...draft, assignedTo })} placeholder="email or name" />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <LabeledInput label="Purchased" type="date" value={draft.purchaseDate} onChange={(purchaseDate) => setDraft({ ...draft, purchaseDate })} />
            </div>
            <button type="button" onClick={submit} aria-label="Add asset" title="Add asset" className="btn-primary mb-0 h-[34px] px-3 py-1 text-xs">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total" value={assets.length} />
        <StatCard label="Assigned" value={assets.filter((a) => a.status === "ASSIGNED").length} tone="good" />
        <StatCard label="Maintenance" value={assets.filter((a) => a.status === "MAINTENANCE").length} tone="warn" />
        <StatCard label="In stock" value={assets.filter((a) => a.status === "IN_STOCK").length} />
      </div>

      <div className="mt-4">
        <TableShell headers={["Name", "Category", "Serial", "Assignee", "Status", "Purchased", ""]} isEmpty={assets.length === 0} empty="No assets registered.">
          {assets.map((asset) => (
            <tr key={asset.id} className="hover:bg-surface-hover/40">
              <td className="px-3 py-2 font-medium text-white">{asset.name}</td>
              <td className="px-3 py-2"><Badge label={asset.category} /></td>
              <td className="px-3 py-2 font-mono text-xs text-slate-400">{asset.serial || "—"}</td>
              <td className="px-3 py-2 text-slate-300">{asset.assignedTo || "—"}</td>
              <td className="px-3 py-2">
                <select
                  value={asset.status}
                  onChange={(e) => updateAssetStatus(asset.id, e.target.value as AssetStatus)}
                  className="rounded border border-surface-border bg-black/20 px-1.5 py-1 text-xs text-slate-200 [&>option]:bg-surface-overlay"
                >
                  {["IN_STOCK", "ASSIGNED", "MAINTENANCE", "RETIRED"].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">{asset.purchaseDate || "—"}</td>
              <td className="px-3 py-2 text-right">
                <GhostButton danger title="Retire & delete" onClick={() => removeAsset(asset.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </GhostButton>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>
    </div>
  );
}

export function ShiftsModule() {
  const shifts = useEnterpriseStore((s) => s.shifts);
  const addShift = useEnterpriseStore((s) => s.addShift);
  const removeShift = useEnterpriseStore((s) => s.removeShift);
  const [draft, setDraft] = useState({
    title: "",
    rotation: "ON_CALL" as "DAILY" | "WEEKLY" | "ON_CALL",
    members: "",
    startsAt: "",
    endsAt: "",
    notes: "",
  });

  const activeShift = shifts.find(
    (shift) =>
      new Date(shift.startsAt).getTime() <= Date.now() && new Date(shift.endsAt).getTime() >= Date.now(),
  );

  function submit(): void {
    if (!draft.title.trim() || !draft.startsAt || !draft.endsAt) return;
    addShift(draft);
    setDraft({ title: "", rotation: "ON_CALL", members: "", startsAt: "", endsAt: "", notes: "" });
  }

  return (
    <div>
      <ModuleHeader
        title="Shift Management & On-Call Rosters"
        description="Organize technical and security rotations. The currently active shift is surfaced for paging and war-room escalation."
      />

      {activeShift ? (
        <Card className="mb-4 border-emerald-500/40">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <AlertTriangle className="h-4 w-4" /> On duty now: {activeShift.title}
          </p>
          <p className="mt-1 text-xs text-slate-400">{activeShift.members || "unassigned"} · until {new Date(activeShift.endsAt).toLocaleString()}</p>
        </Card>
      ) : null}

      <Card title="Schedule shift">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <LabeledInput label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} placeholder="SOC night watch" required />
          <SelectInput
            label="Rotation"
            value={draft.rotation}
            onChange={(rotation) => setDraft({ ...draft, rotation })}
            options={[
              { value: "ON_CALL", label: "On-call" },
              { value: "DAILY", label: "Daily" },
              { value: "WEEKLY", label: "Weekly" },
            ]}
          />
          <LabeledInput label="Members" value={draft.members} onChange={(members) => setDraft({ ...draft, members })} placeholder="alice, bob" />
          <LabeledInput label="Starts" type="datetime-local" value={draft.startsAt} onChange={(startsAt) => setDraft({ ...draft, startsAt })} />
          <LabeledInput label="Ends" type="datetime-local" value={draft.endsAt} onChange={(endsAt) => setDraft({ ...draft, endsAt })} />
          <div className="flex items-end">
            <button type="button" onClick={submit} className="btn-primary h-[34px] w-full py-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>
      </Card>

      <div className="mt-4">
        <TableShell headers={["Title", "Rotation", "Members", "Window", "Notes", ""]} isEmpty={shifts.length === 0} empty="No shifts scheduled.">
          {shifts.map((shift) => (
            <tr key={shift.id} className="hover:bg-surface-hover/40">
              <td className="px-3 py-2 font-medium text-white">{shift.title}</td>
              <td className="px-3 py-2"><Badge label={shift.rotation === "ON_CALL" ? "CRITICAL" : shift.rotation} /></td>
              <td className="px-3 py-2 text-slate-300">{shift.members || "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                {new Date(shift.startsAt).toLocaleString()} → {new Date(shift.endsAt).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">{shift.notes || "—"}</td>
              <td className="px-3 py-2 text-right">
                <GhostButton danger onClick={() => removeShift(shift.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </GhostButton>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>
    </div>
  );
}

export function TicketsModule() {
  const tickets = useEnterpriseStore((s) => s.tickets);
  const addTicket = useEnterpriseStore((s) => s.addTicket);
  const updateTicket = useEnterpriseStore((s) => s.updateTicket);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    channelName: "",
    priority: "MEDIUM" as TicketPriority,
    assignee: "",
  });

  function submit(): void {
    if (!draft.title.trim()) return;
    addTicket({ ...draft, status: "OPEN" });
    audit("it.ticket.created", { target: draft.title, details: `Priority ${draft.priority}` });
    setDraft({ title: "", description: "", channelName: "", priority: "MEDIUM", assignee: "" });
  }

  return (
    <div>
      <ModuleHeader
        title="Internal IT Ticketing Desk"
        description="Convert support flags from channels into managed tickets with full status tracking and priority triage."
      />

      <Card title="Open ticket">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <LabeledInput label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} placeholder="VPN drops hourly" required />
          <SelectInput
            label="Priority"
            value={draft.priority}
            onChange={(priority) => setDraft({ ...draft, priority })}
            options={[
              { value: "LOW", label: "Low" },
              { value: "MEDIUM", label: "Medium" },
              { value: "HIGH", label: "High" },
              { value: "CRITICAL", label: "Critical" },
            ]}
          />
          <LabeledInput label="Origin channel" value={draft.channelName} onChange={(channelName) => setDraft({ ...draft, channelName })} placeholder="#it-support" />
          <LabeledInput label="Assignee" value={draft.assignee} onChange={(assignee) => setDraft({ ...draft, assignee })} placeholder="unassigned" />
          <div className="sm:col-span-2">
            <LabeledInput label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} placeholder="Details…" />
          </div>
        </div>
        <button type="button" onClick={submit} className="btn-primary mt-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Create ticket
        </button>
      </Card>

      <div className="mt-4">
        <TableShell headers={["Ref", "Title", "Origin", "Priority", "Assignee", "Status"]} isEmpty={tickets.length === 0} empty="No tickets yet. Flag a message in any channel to create one.">
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="hover:bg-surface-hover/40">
              <td className="px-3 py-2 font-mono text-xs text-indigo-300">{ticket.ref}</td>
              <td className="px-3 py-2">
                <p className="font-medium text-white">{ticket.title}</p>
                {ticket.description ? <p className="text-xs text-slate-500">{ticket.description}</p> : null}
              </td>
              <td className="px-3 py-2 text-xs text-slate-400">{ticket.channelName ? `#${ticket.channelName}` : "—"}</td>
              <td className="px-3 py-2">
                <select
                  value={ticket.priority}
                  onChange={(e) => updateTicket(ticket.id, { priority: e.target.value as TicketPriority })}
                  className="rounded border border-surface-border bg-black/20 px-1.5 py-1 text-xs text-slate-200 [&>option]:bg-surface-overlay"
                >
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-slate-300">{ticket.assignee || "unassigned"}</td>
              <td className="px-3 py-2">
                <select
                  value={ticket.status}
                  onChange={(e) => updateTicket(ticket.id, { status: e.target.value as TicketStatus })}
                  className={`rounded border px-1.5 py-1 text-xs font-semibold [&>option]:bg-surface-overlay ${
                    ticket.status === "RESOLVED"
                      ? "border-emerald-500/40 text-emerald-300"
                      : ticket.status === "IN_PROGRESS"
                        ? "border-amber-500/40 text-amber-300"
                        : "border-sky-500/40 text-sky-300"
                  }`}
                >
                  {["OPEN", "IN_PROGRESS", "RESOLVED"].map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>
    </div>
  );
}

export function LicensesModule() {
  const licenses = useEnterpriseStore((s) => s.licenses);
  const addLicense = useEnterpriseStore((s) => s.addLicense);
  const removeLicense = useEnterpriseStore((s) => s.removeLicense);
  const [draft, setDraft] = useState({
    name: "",
    vendor: "",
    licenseKey: "",
    seats: "10",
    expiresAt: "",
    alertDaysBefore: "30",
  });

  function submit(): void {
    if (!draft.name.trim() || !draft.expiresAt) return;
    addLicense({
      name: draft.name,
      vendor: draft.vendor,
      licenseKey: draft.licenseKey,
      seats: Number.parseInt(draft.seats, 10) || 1,
      expiresAt: new Date(draft.expiresAt).toISOString(),
      alertDaysBefore: Number.parseInt(draft.alertDaysBefore, 10) || 30,
    });
    setDraft({ name: "", vendor: "", licenseKey: "", seats: "10", expiresAt: "", alertDaysBefore: "30" });
  }

  return (
    <div>
      <ModuleHeader
        title="License & Software Tracker"
        description="Monitor subscription expirations, API keys and seat counts with advance alerts before renewals lapse."
      />

      <Card title="Add license / subscription">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <LabeledInput label="Product" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} placeholder="IDE licenses" required />
          <LabeledInput label="Vendor" value={draft.vendor} onChange={(vendor) => setDraft({ ...draft, vendor })} placeholder="JetBrains" />
          <LabeledInput label="Key / contract #" value={draft.licenseKey} onChange={(licenseKey) => setDraft({ ...draft, licenseKey })} placeholder="••••" />
          <LabeledInput label="Seats" type="number" value={draft.seats} onChange={(seats) => setDraft({ ...draft, seats })} />
          <LabeledInput label="Expires" type="date" value={draft.expiresAt} onChange={(expiresAt) => setDraft({ ...draft, expiresAt })} required />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <LabeledInput label="Alert days" type="number" value={draft.alertDaysBefore} onChange={(alertDaysBefore) => setDraft({ ...draft, alertDaysBefore })} />
            </div>
            <button type="button" onClick={submit} aria-label="Add license" title="Add license" className="btn-primary mb-0 h-[34px] px-3 py-1 text-xs">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>

      <div className="mt-4">
        <TableShell headers={["Product", "Vendor", "Seats", "Expires", "Renewal window", ""]} isEmpty={licenses.length === 0} empty="No licenses tracked.">
          {licenses.map((license) => {
            const daysLeft = Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / 86_400_000);
            const expiring = daysLeft <= license.alertDaysBefore;
            return (
              <tr key={license.id} className="hover:bg-surface-hover/40">
                <td className="px-3 py-2 font-medium text-white">{license.name}</td>
                <td className="px-3 py-2 text-slate-300">{license.vendor || "—"}</td>
                <td className="px-3 py-2 text-slate-300">{license.seats}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                  {new Date(license.expiresAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  {expiring ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                      <AlertTriangle className="h-3 w-3" /> {daysLeft <= 0 ? "EXPIRED" : `${daysLeft}d left`}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">OK · {daysLeft}d</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <GhostButton danger onClick={() => removeLicense(license.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </GhostButton>
                </td>
              </tr>
            );
          })}
        </TableShell>
      </div>
    </div>
  );
}

interface ApprovalDraftLevel {
  approver: string;
}

export function ProcurementModule() {
  const procurements = useEnterpriseStore((s) => s.procurements);
  const addProcurement = useEnterpriseStore((s) => s.addProcurement);
  const decide = useEnterpriseStore((s) => s.decideProcurement);
  const [draft, setDraft] = useState({
    title: "",
    item: "",
    estimatedCost: "",
    justification: "",
    requestedBy: "",
    levels: "IT Manager, CFO, CEO",
  });

  function submit(): void {
    if (!draft.title.trim()) return;
    const approvers = draft.levels
      .split(",")
      .map((level) => level.trim())
      .filter(Boolean)
      .map((approver): ApprovalDraftLevel => ({ approver }));
    if (approvers.length === 0) return;
    addProcurement({
      title: draft.title,
      item: draft.item,
      estimatedCost: draft.estimatedCost,
      requestedBy: draft.requestedBy,
      justification: draft.justification,
      levels: approvers.map(({ approver }) => ({ approver, decision: "PENDING" })),
    });
    audit("procurement.request.created", { target: draft.title, details: `${approvers.length}-level approval pipeline` });
    setDraft({ title: "", item: "", estimatedCost: "", justification: "", requestedBy: "", levels: "IT Manager, CFO, CEO" });
  }

  function overallStatus(levels: readonly { decision: string }[]): "APPROVED" | "REJECTED" | "PENDING" {
    if (levels.some((l) => l.decision === "REJECTED")) return "REJECTED";
    if (levels.every((l) => l.decision === "APPROVED")) return "APPROVED";
    return "PENDING";
  }

  const requestedBy = draft.requestedBy;

  return (
    <div>
      <ModuleHeader
        title="Procurement & Expense Approvals"
        description="Multi-level administrative approval pipelines for equipment and budget requests. Each stage must be explicitly approved before the request advances."
      />

      <Card title="New request">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <LabeledInput label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} placeholder="Docking stations Q4" required />
          <LabeledInput label="Item(s)" value={draft.item} onChange={(item) => setDraft({ ...draft, item })} placeholder="12 × USB-C docks" />
          <LabeledInput label="Est. cost" value={draft.estimatedCost} onChange={(estimatedCost) => setDraft({ ...draft, estimatedCost })} placeholder="€3,600" />
          <LabeledInput label="Requested by" value={requestedBy} onChange={(requestedByLocal) => setDraft({ ...draft, requestedBy: requestedByLocal })} placeholder="name / team" />
          <LabeledInput label="Approval chain (comma-separated)" value={draft.levels} onChange={(levels) => setDraft({ ...draft, levels })} />
        </div>
        <button type="button" onClick={submit} className="btn-primary mt-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Submit for approval
        </button>
      </Card>

      <div className="mt-4 space-y-3">
        {procurements.map((request) => {
          const activeIndex = request.levels.findIndex((level) => level.decision === "PENDING");
          return (
            <Card key={request.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">{request.title}</p>
                  <p className="text-xs text-slate-500">
                    {request.item || "—"} · {request.estimatedCost || "—"} · by {request.requestedBy || "unknown"} ·{" "}
                    {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge label={overallStatus(request.levels)} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {request.levels.map((level, index) => (
                  <span key={`${request.id}-${index}`} className="flex items-center gap-1.5">
                    <span
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                        level.decision === "APPROVED"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : level.decision === "REJECTED"
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                            : index === activeIndex
                              ? "border-accent bg-accent-muted/40 text-white"
                              : "border-surface-border text-slate-500"
                      }`}
                    >
                      {index + 1}. {level.approver}
                    </span>
                    {index === activeIndex ? (
                      <>
                        <GhostButton onClick={() => decide(request.id, index, "APPROVED")}>Approve</GhostButton>
                        <GhostButton danger onClick={() => decide(request.id, index, "REJECTED")}>Reject</GhostButton>
                      </>
                    ) : null}
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
        {procurements.length === 0 ? <p className="text-sm text-slate-500">No procurement requests yet.</p> : null}
      </div>
    </div>
  );
}
