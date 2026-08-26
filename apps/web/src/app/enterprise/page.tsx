"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  BrainCircuit,
  ClipboardList,
  Download,
  EyeOff,
  FileClock,
  Fingerprint,
  Gauge,
  KeyRound,
  Radio,
  ScrollText,
  ShieldCheck,
  Siren,
} from "lucide-react";
import WatermarkOverlay from "@/components/security/WatermarkOverlay";
import { useAuditStore } from "@/lib/audit";
import { useEnterpriseStore } from "@/stores/enterprise";
import { ModuleHeader } from "@/components/enterprise/ui";
import { AuditModule, AccessControlModule, WhistleblowingModule, StampingModule, BackupExportModule } from "@/components/enterprise/GovernanceModules";
import { AssetsModule, ShiftsModule, TicketsModule, LicensesModule, ProcurementModule } from "@/components/enterprise/OpsModules";
import { WarRoomModule, KnowledgeModule, VersionsModule, SimulationsModule } from "@/components/enterprise/SecurityModules";

const MODULES = [
  { id: "overview", label: "Overview", icon: Gauge, group: "Command" },
  { id: "warroom", label: "Incident War Rooms", icon: Siren, group: "Command" },
  { id: "audit", label: "Audit Log & SIEM", icon: ScrollText, group: "Governance" },
  { id: "access", label: "Access Control & SSO", icon: KeyRound, group: "Governance" },
  { id: "whistleblow", label: "Whistleblowing", icon: EyeOff, group: "Governance" },
  { id: "stamping", label: "Digital Stamping", icon: Fingerprint, group: "Governance" },
  { id: "backup", label: "Backup & Legal Export", icon: Download, group: "Governance" },
  { id: "assets", label: "IT Assets", icon: Boxes, group: "Operations" },
  { id: "shifts", label: "Shifts & On-Call", icon: Radio, group: "Operations" },
  { id: "tickets", label: "IT Ticketing Desk", icon: ClipboardList, group: "Operations" },
  { id: "licenses", label: "License Tracker", icon: BadgeCheck, group: "Operations" },
  { id: "procurement", label: "Procurement Approvals", icon: FileClock, group: "Operations" },
  { id: "knowledge", label: "Knowledge Assistant", icon: BrainCircuit, group: "Intelligence" },
  { id: "versions", label: "Version History", icon: FileClock, group: "Intelligence" },
  { id: "simulations", label: "Phishing Simulation", icon: ShieldCheck, group: "Intelligence" },
] as const;

type ModuleId = (typeof MODULES)[number]["id"];

export default function EnterprisePage() {
  const [mounted, setMounted] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleId>("overview");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <main className="flex min-h-screen items-center justify-center bg-surface text-sm text-slate-500">Loading console…</main>;
  }

  const groups = [...new Set(MODULES.map((m) => m.group))];

  return (
    <main className="flex h-screen overflow-hidden bg-surface">
      <WatermarkOverlay />

      <nav aria-label="Enterprise modules" className="flex w-64 shrink-0 flex-col border-r border-surface-border bg-surface-raised">
        <header className="flex items-center gap-2 border-b border-surface-border px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">Enterprise Console</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Sovereign deployment</p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {groups.map((group) => (
            <section key={group} className="mb-3">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {group}
              </p>
              <ul className="space-y-0.5">
                {MODULES.filter((m) => m.group === group).map((module) => (
                  <li key={module.id}>
                    <button
                      type="button"
                      onClick={() => setActiveModule(module.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors ${
                        activeModule === module.id
                          ? "bg-accent-muted/60 font-semibold text-white"
                          : "text-slate-400 hover:bg-surface-hover hover:text-slate-200"
                      }`}
                    >
                      <module.icon className="h-4 w-4 shrink-0 opacity-80" />
                      {module.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="border-t border-surface-border p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-surface-hover hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
          </Link>
        </footer>
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {activeModule === "overview" ? <OverviewModule onNavigate={setActiveModule} /> : null}
        {activeModule === "warroom" ? <WarRoomModule /> : null}
        {activeModule === "audit" ? <AuditModule /> : null}
        {activeModule === "access" ? <AccessControlModule /> : null}
        {activeModule === "whistleblow" ? <WhistleblowingModule /> : null}
        {activeModule === "stamping" ? <StampingModule /> : null}
        {activeModule === "backup" ? <BackupExportModule /> : null}
        {activeModule === "assets" ? <AssetsModule /> : null}
        {activeModule === "shifts" ? <ShiftsModule /> : null}
        {activeModule === "tickets" ? <TicketsModule /> : null}
        {activeModule === "licenses" ? <LicensesModule /> : null}
        {activeModule === "procurement" ? <ProcurementModule /> : null}
        {activeModule === "knowledge" ? <KnowledgeModule /> : null}
        {activeModule === "versions" ? <VersionsModule /> : null}
        {activeModule === "simulations" ? <SimulationsModule /> : null}
      </div>
    </main>
  );
}

function OverviewModule({ onNavigate }: { onNavigate: (moduleId: ModuleId) => void }) {
  const tickets = useEnterpriseStore((s) => s.tickets);
  const licenses = useEnterpriseStore((s) => s.licenses);
  const assets = useEnterpriseStore((s) => s.assets);
  const auditEvents = useAuditStore((s) => s.events);

  const openTickets = tickets.filter((t) => t.status !== "RESOLVED").length;
  const expiringLicenses = licenses.filter((l) => {
    const days = (new Date(l.expiresAt).getTime() - Date.now()) / 86_400_000;
    return days <= l.alertDaysBefore;
  }).length;
  const criticalEvents = auditEvents.filter((e) => e.severity === "CRITICAL").length;
  const assignedAssets = assets.filter((a) => a.status === "ASSIGNED").length;

  return (
    <div>
      <ModuleHeader
        title="Compliance & Operations Overview"
        description="Sovereign, air-gap-ready control plane for your OpenTeams deployment. All records stay in this deployment's local storage until exported through encrypted channels."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open tickets" value={openTickets} tone="text-sky-300" hint="IT ticketing desk" moduleId="tickets" onNavigate={onNavigate} />
        <StatTile label="Expiring licenses" value={expiringLicenses} tone="text-amber-300" hint="Needing renewal" moduleId="licenses" onNavigate={onNavigate} />
        <StatTile label="Critical events" value={criticalEvents} tone="text-rose-300" hint="In the audit trail" moduleId="audit" onNavigate={onNavigate} />
        <StatTile label="Assigned assets" value={assignedAssets} tone="text-emerald-300" hint="Hardware in the field" moduleId="assets" onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function StatTile(props: {
  label: string;
  value: number;
  hint: string;
  tone: string;
  moduleId: ModuleId;
  onNavigate: (moduleId: ModuleId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onNavigate(props.moduleId)}
      className="rounded-xl border border-surface-border bg-surface-raised p-4 text-left transition-colors hover:border-accent"
    >
      <p className={`text-2xl font-bold ${props.tone}`}>{props.value}</p>
      <p className="text-sm font-semibold text-white">{props.label}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-500">{props.hint}</p>
    </button>
  );
}
