import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AssetCategory = "LAPTOP" | "PHONE" | "SERVER" | "SECURITY_KEY" | "OTHER";
export type AssetStatus = "IN_STOCK" | "ASSIGNED" | "MAINTENANCE" | "RETIRED";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ApprovalDecision = "PENDING" | "APPROVED" | "REJECTED";
export type ReportStatus = "NEW" | "ACKNOWLEDGED" | "CLOSED";

export interface Asset {
  readonly id: string;
  name: string;
  category: AssetCategory;
  serial: string;
  assignedTo: string;
  status: AssetStatus;
  purchaseDate: string;
}

export interface Shift {
  readonly id: string;
  title: string;
  rotation: "DAILY" | "WEEKLY" | "ON_CALL";
  members: string;
  startsAt: string;
  endsAt: string;
  notes: string;
}

export interface Ticket {
  readonly id: string;
  ref: string;
  title: string;
  description: string;
  channelName: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
  createdAt: string;
}

export interface SoftwareLicense {
  readonly id: string;
  name: string;
  vendor: string;
  licenseKey: string;
  seats: number;
  expiresAt: string;
  alertDaysBefore: number;
}

export interface ApprovalLevel {
  approver: string;
  decision: ApprovalDecision;
}

export interface ProcurementRequest {
  readonly id: string;
  title: string;
  item: string;
  estimatedCost: string;
  requestedBy: string;
  justification: string;
  levels: readonly ApprovalLevel[];
  createdAt: string;
}

export interface WhistleblowReport {
  readonly id: string;
  subject: string;
  body: string;
  status: ReportStatus;
  createdAt: string;
}

export interface DocumentStamp {
  readonly id: string;
  fileName: string;
  sha256: string;
  stampedBy: string;
  note: string;
  stampedAt: string;
}

export interface VersionEntry {
  readonly id: string;
  entityType: "FILE" | "MESSAGE" | "DOCUMENT";
  label: string;
  summary: string;
  savedBy: string;
  savedAt: string;
}

interface SimulationTarget {
  email: string;
  clicked: boolean;
  reported: boolean;
}

export interface SimulationCampaign {
  readonly id: string;
  name: string;
  template: string;
  targets: readonly SimulationTarget[];
  createdAt: string;
}

export interface KnowledgeDoc {
  readonly id: string;
  title: string;
  content: string;
  addedAt: string;
}

interface EnterpriseState {
  readonly assets: readonly Asset[];
  readonly shifts: readonly Shift[];
  readonly tickets: readonly Ticket[];
  readonly licenses: readonly SoftwareLicense[];
  readonly procurements: readonly ProcurementRequest[];
  readonly reports: readonly WhistleblowReport[];
  readonly stamps: readonly DocumentStamp[];
  readonly versions: readonly VersionEntry[];
  readonly simulations: readonly SimulationCampaign[];
  readonly knowledgeDocs: readonly KnowledgeDoc[];

  addAsset: (asset: Omit<Asset, "id">) => void;
  updateAssetStatus: (id: string, status: AssetStatus) => void;
  removeAsset: (id: string) => void;

  addShift: (shift: Omit<Shift, "id">) => void;
  removeShift: (id: string) => void;

  addTicket: (ticket: Omit<Ticket, "id" | "ref" | "createdAt">) => void;
  updateTicket: (id: string, patch: Partial<Pick<Ticket, "status" | "assignee" | "priority">>) => void;

  addLicense: (license: Omit<SoftwareLicense, "id">) => void;
  removeLicense: (id: string) => void;

  addProcurement: (request: Omit<ProcurementRequest, "id" | "createdAt">) => void;
  decideProcurement: (id: string, levelIndex: number, decision: Exclude<ApprovalDecision, "PENDING">) => void;

  addReport: (report: Omit<WhistleblowReport, "id" | "createdAt" | "status">) => void;
  updateReportStatus: (id: string, status: ReportStatus) => void;

  addStamp: (stamp: Omit<DocumentStamp, "id" | "stampedAt">) => void;
  addVersion: (version: Omit<VersionEntry, "id" | "savedAt" | "savedBy">) => void;

  addSimulation: (campaign: Omit<SimulationCampaign, "id" | "createdAt">) => void;
  updateSimulationTarget: (
    campaignId: string,
    email: string,
    patch: Partial<Pick<SimulationTarget, "clicked" | "reported">>,
  ) => void;

  addKnowledgeDoc: (doc: Omit<KnowledgeDoc, "id" | "addedAt">) => void;
  removeKnowledgeDoc: (id: string) => void;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useEnterpriseStore = create<EnterpriseState>()(
  persist(
    (set) => ({
      assets: [],
      shifts: [],
      tickets: [],
      licenses: [],
      procurements: [],
      reports: [],
      stamps: [],
      versions: [],
      simulations: [],
      knowledgeDocs: [],

      addAsset: (asset) =>
        set((s) => ({ assets: [{ ...asset, id: uid() }, ...s.assets] })),
      updateAssetStatus: (id, status) =>
        set((s) => ({
          assets: s.assets.map((a) => (a.id === id ? { ...a, status } : a)),
        })),
      removeAsset: (id) =>
        set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),

      addShift: (shift) => set((s) => ({ shifts: [{ ...shift, id: uid() }, ...s.shifts] })),
      removeShift: (id) => set((s) => ({ shifts: s.shifts.filter((x) => x.id !== id) })),

      addTicket: (ticket) =>
        set((s) => ({
          tickets: [
            {
              ...ticket,
              id: uid(),
              ref: `IT-${String(s.tickets.length + 1).padStart(4, "0")}`,
              createdAt: new Date().toISOString(),
            },
            ...s.tickets,
          ],
        })),
      updateTicket: (id, patch) =>
        set((s) => ({
          tickets: s.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      addLicense: (license) =>
        set((s) => ({ licenses: [{ ...license, id: uid() }, ...s.licenses] })),
      removeLicense: (id) =>
        set((s) => ({ licenses: s.licenses.filter((l) => l.id !== id) })),

      addProcurement: (request) =>
        set((s) => ({
          procurements: [
            { ...request, id: uid(), createdAt: new Date().toISOString() },
            ...s.procurements,
          ],
        })),
      decideProcurement: (id, levelIndex, decision) =>
        set((s) => ({
          procurements: s.procurements.map((request) => {
            if (request.id !== id) return request;
            const levels = request.levels.map((level, i) =>
              i === levelIndex ? { ...level, decision } : level,
            );
            if (decision === "REJECTED") {
              return { ...request, levels };
            }
            return { ...request, levels };
          }),
        })),

      addReport: (report) =>
        set((s) => ({
          reports: [
            { ...report, id: uid(), status: "NEW" as const, createdAt: new Date().toISOString() },
            ...s.reports,
          ],
        })),
      updateReportStatus: (id, status) =>
        set((s) => ({
          reports: s.reports.map((r) => (r.id === id ? { ...r, status } : r)),
        })),

      addStamp: (stamp) =>
        set((s) => ({
          stamps: [{ ...stamp, id: uid(), stampedAt: new Date().toISOString() }, ...s.stamps],
        })),
      addVersion: (version) =>
        set((s) => ({
          versions: [
            { ...version, id: uid(), savedAt: new Date().toISOString(), savedBy: "console" },
            ...s.versions,
          ],
        })),

      addSimulation: (campaign) =>
        set((s) => ({
          simulations: [
            { ...campaign, id: uid(), createdAt: new Date().toISOString() },
            ...s.simulations,
          ],
        })),
      updateSimulationTarget: (campaignId, email, patch) =>
        set((s) => ({
          simulations: s.simulations.map((campaign) =>
            campaign.id === campaignId
              ? {
                  ...campaign,
                  targets: campaign.targets.map((target) =>
                    target.email === email ? { ...target, ...patch } : target,
                  ),
                }
              : campaign,
          ),
        })),

      addKnowledgeDoc: (doc) =>
        set((s) => ({
          knowledgeDocs: [{ ...doc, id: uid(), addedAt: new Date().toISOString() }, ...s.knowledgeDocs],
        })),
      removeKnowledgeDoc: (id) =>
        set((s) => ({ knowledgeDocs: s.knowledgeDocs.filter((d) => d.id !== id) })),
    }),
    { name: "openteams.enterprise.v1", storage: createJSONStorage(() => localStorage) },
  ),
);
