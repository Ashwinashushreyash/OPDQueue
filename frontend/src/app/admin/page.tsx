"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import {
  AdminCabin,
  AdminEvent,
  AdminOverview,
  CabinStatus,
  callNextAtCabin,
  flushDayTokens,
  getAdminEvents,
  getAdminOverview,
  getCabins,
  triggerRebalance,
  updateCabinStatus,
} from "@/lib/api";

const WING_FILTERS = [
  { label: "All Wings", value: "all" },
  { label: "Wing A", value: "Wing A" },
  { label: "Wing B", value: "Wing B" },
  { label: "Wing C", value: "Wing C" },
];

const STATUS_META: Record<CabinStatus, { label: string; dot: string; tag: string }> = {
  active: { label: "Active", dot: "bg-primary", tag: "bg-secondary-container text-on-secondary-container" },
  paused: { label: "Paused", dot: "bg-tertiary animate-pulse", tag: "bg-tertiary-fixed text-on-tertiary-fixed" },
  on_break: { label: "On Break", dot: "bg-outline", tag: "bg-surface-container-high text-on-surface-variant" },
  emergency: { label: "Emergency", dot: "bg-error animate-ping", tag: "bg-error-container text-on-error-container" },
};

const EVENT_ICON: Record<string, { icon: string; color: string }> = {
  emergency_insertion: { icon: "e911_emergency", color: "text-error" },
  status_change: { icon: "tune", color: "text-secondary" },
  rebalance: { icon: "alt_route", color: "text-primary" },
  flush: { icon: "restart_alt", color: "text-on-surface-variant" },
  doctor_call: { icon: "notifications_active", color: "text-tertiary" },
};

function eventMeta(type: string) {
  return EVENT_ICON[type] ?? { icon: "info", color: "text-on-surface-variant" };
}

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [cabins, setCabins] = useState<AdminCabin[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [wing, setWing] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorNotice, setErrorNotice] = useState("");
  const [isFlushDialogOpen, setFlushDialogOpen] = useState(false);
  const [rebalanceProposal, setRebalanceProposal] = useState<{ source: string; target: string; tokens: number } | null>(null);

  const busiestCabin = useMemo(
    () => [...cabins].filter((c) => c.status === "active").sort((a, b) => b.queue_depth - a.queue_depth)[0] ?? null,
    [cabins],
  );
  const idleCabin = useMemo(
    () => [...cabins].filter((c) => c.status === "active").sort((a, b) => a.queue_depth - b.queue_depth)[0] ?? null,
    [cabins],
  );

  const refreshAll = useCallback(async () => {
    try {
      const [overviewData, cabinData, eventData] = await Promise.all([
        getAdminOverview(),
        getCabins(wing),
        getAdminEvents(),
      ]);
      setOverview(overviewData);
      setCabins(cabinData);
      setEvents(eventData);
    } catch {
      setErrorNotice("Fleet telemetry unavailable. Retrying on next tick…");
    } finally {
      setIsLoading(false);
    }
  }, [wing]);

  useEffect(() => {
    setIsLoading(true);
    void refreshAll();
    const interval = window.setInterval(() => void refreshAll(), 15000);
    return () => window.clearInterval(interval);
  }, [refreshAll]);

  function runAction(action: () => Promise<string>) {
    if (isBusy) return;
    setIsBusy(true);
    setErrorNotice("");
    action()
      .then((message) => setNotice(message))
      .catch((error: unknown) => setErrorNotice(error instanceof Error ? error.message : "Fleet action failed."))
      .finally(() => {
        setIsBusy(false);
        void refreshAll();
      });
  }

  function handleStatusToggle(cabin: AdminCabin) {
    const nextStatus: CabinStatus = cabin.status === "on_break" ? "active" : cabin.status === "active" ? "on_break" : "active";
    runAction(async () => {
      const { cabin: updated } = await updateCabinStatus(cabin.id, nextStatus);
      return `${updated.cabin_number} is now ${STATUS_META[updated.status].label.toLowerCase()}${updated.status === "active" ? " — load tag: " + updated.load_tag : ""}.`;
    });
  }

  function handleCallNext(cabin: AdminCabin) {
    runAction(async () => {
      await callNextAtCabin(cabin.cabin_number);
      return `${cabin.cabin_number}: next waiting token called to consultation.`;
    });
  }

  function proposeRebalance() {
    if (!busiestCabin || !idleCabin || busiestCabin.id === idleCabin.id) {
      setErrorNotice("No rebalance opportunity detected — fleet load is balanced.");
      return;
    }
    const tokens = Math.min(4, Math.max(1, busiestCabin.queue_depth - idleCabin.queue_depth - 1));
    setRebalanceProposal({ source: busiestCabin.cabin_number, target: idleCabin.cabin_number, tokens });
  }

  function executeRebalance() {
    if (!rebalanceProposal) return;
    const source = cabins.find((c) => c.cabin_number === rebalanceProposal.source);
    const target = cabins.find((c) => c.cabin_number === rebalanceProposal.target);
    runAction(async () => {
      const result = await triggerRebalance({
        source_cabin_id: source?.id,
        target_cabin_id: target?.id,
        tokens_to_shift: rebalanceProposal.tokens,
      });
      setRebalanceProposal(null);
      return `Rebalance executed: ${result.shifted_count} routine token(s) shifted ${result.source_cabin} → ${result.target_cabin}. Projected ~${result.mins_saved} min saved across the fleet.`;
    });
  }

  function handleFlush() {
    runAction(async () => {
      const { message } = await flushDayTokens();
      setFlushDialogOpen(false);
      return `End-of-day flush complete: ${message}.`;
    });
  }

  if (isLoading || !overview) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
          <span className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-semibold">Syncing fleet telemetry…</p>
        </div>
      </div>
    );
  }

  const { kpis, acuity_mix, emergency_telemetry } = overview;
  const totalTokens = kpis.active || 1;
  const acuitySegments = [
    { key: "routine", label: "Standard OPD Queue", color: "text-primary", stroke: "stroke-primary", value: acuity_mix.routine },
    { key: "priority", label: "Fast-Track Diagnostics", color: "", stroke: "stroke-tertiary-container", value: acuity_mix.priority },
    { key: "emergency", label: "Urgent / Code Red", color: "text-error", stroke: "stroke-error", value: acuity_mix.emergency },
  ];
  let donutOffset = 0;

  return (
    <div className="min-h-screen bg-background pb-12">
      <Header
        activeToken={busiestCabin?.serving_token ?? "—"}
        estimatedWait={`${kpis.mean_wait_mins} min avg`}
        role="admin"
        userName="Chief Med. Admin"
        userIdentifier="Admin Command"
        userInitials="CA"
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        {/* Command banner */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider bg-secondary-container px-2.5 py-0.5 rounded-full font-semibold">Hospital Command Grid</span>
              <span className="text-xs text-on-surface-variant flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${overview.online ? "bg-primary animate-pulse" : "bg-outline-variant"}`} />
                {overview.online ? "Real-Time Stream Synchronized" : "Offline simulation — backend unreachable"}
              </span>
            </div>
            <h1 className="font-headline-sm text-2xl font-bold text-on-surface tracking-tight mt-1">Outpatient Fleet Telemetry &amp; Allocation</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-2 rounded-xl shadow-sm border border-surface-container-high/40">
              <span className="material-symbols-outlined text-secondary text-[18px]">domain</span>
              <select value={wing} onChange={(event) => setWing(event.target.value)} className="bg-transparent text-sm font-semibold text-on-surface outline-none cursor-pointer" aria-label="Filter cabins by wing">
                {WING_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <button
              onClick={() => setFlushDialogOpen(true)}
              disabled={isBusy}
              className="flex items-center gap-1.5 bg-surface-container-highest hover:bg-surface-container text-on-surface px-3 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">restart_alt</span>
              Flush Day Tokens
            </button>
            <button
              onClick={proposeRebalance}
              disabled={isBusy}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary px-3 py-2 rounded-xl text-sm font-semibold shadow-md transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">alt_route</span>
              Auto-Rebalance Wings
            </button>
          </div>
        </section>

        {errorNotice && (
          <div className="mt-4 rounded-xl border border-error/30 bg-error-container px-4 py-3 flex items-start gap-3 text-sm text-on-error-container">
            <span className="material-symbols-outlined text-error">warning</span>
            <div className="flex-1"><strong>Fleet alert.</strong> {errorNotice}</div>
            <button onClick={() => setErrorNotice("")} aria-label="Dismiss alert">×</button>
          </div>
        )}
        {notice && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-secondary-container px-4 py-3 flex items-start gap-3 text-sm text-on-secondary-container">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            <div className="flex-1"><strong>Command executed.</strong> {notice}</div>
            <button onClick={() => setNotice("")} aria-label="Dismiss notice">×</button>
          </div>
        )}

        {/* KPI row */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-surface-container-low rounded-full -mr-8 -mt-8 pointer-events-none" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] uppercase font-semibold text-on-surface-variant">Daily Patient Intake</span>
                <p className="text-4xl font-bold text-on-surface mt-1">{kpis.daily_intake}</p>
              </div>
              <span className="p-2 rounded-lg bg-surface-container-low text-primary material-symbols-outlined">groups</span>
            </div>
            <div className="mt-4">
              <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden flex">
                <div className="bg-primary h-full" style={{ width: "74%" }} />
                <div className="bg-tertiary-container h-full" style={{ width: "16%" }} />
                <div className="bg-surface-container h-full" style={{ width: "10%" }} />
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant mt-2">
                <span>{kpis.completed} Completed</span>
                <span className="text-primary">{kpis.active} Active</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] uppercase font-semibold text-on-surface-variant">Mean Wait-to-Consult</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-4xl font-bold text-on-surface">{kpis.mean_wait_mins}</p>
                  <span className="text-sm text-on-surface-variant">mins</span>
                </div>
              </div>
              <span className="p-2 rounded-lg bg-surface-container-low text-secondary material-symbols-outlined">timer</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="flex items-center gap-1 text-primary text-sm font-semibold">
                <span className="material-symbols-outlined text-[16px]">trending_down</span>
                {kpis.wait_trend}
              </span>
              <span className="text-[11px] font-semibold text-secondary bg-secondary-container px-2 py-0.5 rounded-full">Threshold: {kpis.wait_threshold}</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] uppercase font-semibold text-on-surface-variant">Active Clinician Units</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <p className="text-4xl font-bold text-on-surface">{kpis.active_clinician_units}</p>
                  <span className="text-xl text-on-surface-variant">/ {kpis.total_clinician_units}</span>
                </div>
              </div>
              <span className="p-2 rounded-lg bg-surface-container-low text-primary material-symbols-outlined">stethoscope</span>
            </div>
            <div className="flex items-center justify-between pt-2 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-on-surface"><span className="w-2 h-2 rounded-full bg-primary" />{kpis.operating_percentage}% Operating</span>
              <span className={kpis.sterilization_hold > 0 ? "text-error" : "text-on-surface-variant"}>{kpis.sterilization_hold} On Break</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] uppercase font-semibold text-error flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">warning</span> Bottleneck Detected
                </span>
                <p className="text-base font-bold text-on-surface mt-1">{kpis.bottleneck.wing}</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[11px] font-semibold">{kpis.bottleneck.queued} Queued</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-on-surface-variant">Wait ETA ~{kpis.bottleneck.wait_eta_mins} min</span>
              <button onClick={proposeRebalance} disabled={isBusy} className="text-[11px] text-primary hover:text-primary-container font-semibold uppercase tracking-wider flex items-center gap-0.5 disabled:opacity-60">
                Auto-Route <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
          {/* Left: cabin grid + hourly chart */}
          <div className="xl:col-span-8 flex flex-col gap-5">
            <section className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-on-surface">Cabin Grid Telemetry</h2>
                <span className="text-[11px] bg-surface-container-high text-on-surface px-2 py-0.5 rounded-full">{cabins.length} Stations Monitored</span>
              </div>
              <span className="text-xs text-on-surface-variant">Emergency load: {emergency_telemetry.active_emergencies}/{emergency_telemetry.max_reserve_capacity} • Latency {emergency_telemetry.latency_to_cabin_mins} min • {emergency_telemetry.escalation_protocol}</span>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cabins.map((cabin) => {
                const meta = STATUS_META[cabin.status];
                const estClear = cabin.status === "on_break" ? "Resumes soon" : `~${Math.round(cabin.queue_depth * (cabin.avg_velocity_mins || 8))}m clear`;
                return (
                  <div key={cabin.id} className={`bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col justify-between transition-all hover:shadow-md ${cabin.status === "on_break" ? "opacity-85 hover:opacity-100" : ""}`}>
                    <div className="flex items-start justify-between pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs">{cabin.avatar_initials}</div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-on-surface">{cabin.cabin_number}</span>
                            <span className={`w-2 h-2 rounded-full ${meta.dot}`} title={meta.label} />
                          </div>
                          <span className="text-xs text-on-surface-variant truncate block">{cabin.doctor_name} ({cabin.department})</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${meta.tag}`}>{cabin.load_tag}</span>
                    </div>
                    <div className="bg-surface-container-low p-3 rounded-xl my-2 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] uppercase text-on-surface-variant">Serving Token</span>
                        <p className={`text-2xl font-bold leading-none mt-1 ${cabin.status === "on_break" ? "text-outline" : "text-primary"}`}>{cabin.serving_token ?? "—"}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-on-surface-variant">Queue Depth</span>
                        <p className={`text-base font-bold mt-1 ${cabin.queue_depth > 12 ? "text-error" : "text-on-surface"}`}>{cabin.queue_depth} awaiting</p>
                        <span className="text-[11px] text-secondary">{estClear}</span>
                      </div>
                    </div>
                    <div className="pt-2 grid grid-cols-3 gap-1.5">
                      <button onClick={() => handleCallNext(cabin)} disabled={isBusy} className="py-1.5 px-2 bg-primary hover:bg-primary-container text-on-primary text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-60">Call Next</button>
                      <button onClick={() => handleStatusToggle(cabin)} disabled={isBusy} className="py-1.5 px-2 bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-60">
                        {cabin.status === "on_break" ? "Resume" : cabin.status === "active" ? "Break" : "Activate"}
                      </button>
                      <button onClick={proposeRebalance} disabled={isBusy} className="py-1.5 px-2 bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-60">Reroute</button>
                    </div>
                  </div>
                );
              })}
              {cabins.length === 0 && <p className="text-sm text-on-surface-variant col-span-full text-center py-8">No cabins match this wing filter.</p>}
            </div>

            {/* Hourly throughput chart (visual, matching Stitch) */}
            <section className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-on-surface">Hourly OPD Intake Telemetry &amp; Peak Projection</h2>
                  <span className="text-xs text-on-surface-variant">Live queue throughput with rolling forecast</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-semibold text-on-surface-variant">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-primary rounded-full" /> Actual Volume</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-surface-container-high border border-dashed border-outline-variant rounded-full" /> Surge Estimate</span>
                </div>
              </div>
              <div className="w-full h-44 flex items-end justify-between gap-2 pt-3 px-2 bg-surface-container-low/40 rounded-xl">
                {[
                  { label: "08:00", height: 38, estimated: false },
                  { label: "09:00", height: 55, estimated: false },
                  { label: "10:00", height: 84, peak: true, estimated: false },
                  { label: "11:00", height: 96, estimated: false },
                  { label: "12:00", height: 78, estimated: false },
                  { label: "13:00", height: 48, estimated: false },
                  { label: "14:00", height: 42, estimated: true },
                  { label: "15:00", height: 32, estimated: true },
                ].map((bar) => (
                  <div key={bar.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <div
                      className={`w-full rounded-t transition-all relative ${bar.estimated ? "bg-surface-container-high border border-dashed border-outline-variant" : "bg-primary/80 hover:bg-primary"}`}
                      style={{ height: `${bar.height}%` }}
                    >
                      {bar.peak && <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-on-surface text-surface text-[10px] px-1 py-0.5 rounded font-bold">Peak</div>}
                    </div>
                    <span className={`text-[11px] ${bar.peak || bar.height >= 96 ? "text-on-surface font-semibold" : "text-on-surface-variant"}`}>{bar.label}{bar.estimated ? " (Est)" : ""}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right: rebalancer, acuity donut, audit stream */}
          <div className="xl:col-span-4 flex flex-col gap-5">
            <section className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">smart_toy</span>
                  <h2 className="text-base font-bold text-on-surface">Dynamic Queue Rebalancer</h2>
                </div>
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              </div>

              {rebalanceProposal ? (
                <div className="p-4 bg-secondary-container/40 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-primary uppercase font-bold tracking-wide">Optimized Route Proposal</span>
                    <span className="text-[11px] text-on-secondary-container bg-surface-container-lowest px-2 py-0.5 rounded font-semibold">Save ~{Math.round(rebalanceProposal.tokens * 3.5)} Min</span>
                  </div>
                  <p className="text-sm text-on-surface font-medium leading-snug">
                    Shift <span className="font-bold text-primary">{rebalanceProposal.tokens} routine token(s)</span> from <span className="font-semibold">{rebalanceProposal.source}</span> to <span className="font-semibold">{rebalanceProposal.target}</span>.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={executeRebalance} disabled={isBusy} className="flex-1 bg-primary hover:bg-primary-container text-on-primary py-2 px-3 rounded-lg text-sm font-semibold transition-all shadow-sm disabled:opacity-60">Execute Rebalance</button>
                    <button onClick={() => setRebalanceProposal(null)} className="bg-surface-container hover:bg-surface-container-high text-on-surface-variant py-2 px-3 rounded-lg text-sm transition-colors">Dismiss</button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-surface-container-low rounded-xl text-sm text-on-surface-variant">
                  Fleet analysis idle. Run <span className="font-semibold text-on-surface">Auto-Rebalance Wings</span> to detect overloaded cabins and generate a route proposal.
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant pt-1">
                <span className="uppercase">Emergency Override Pool</span>
                <span className="text-primary">{emergency_telemetry.active_emergencies} active / {emergency_telemetry.max_reserve_capacity} max</span>
              </div>
              <div className="p-3 bg-surface-container-low rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[20px]">e911_emergency</span>
                  <span className="text-sm text-on-surface">{emergency_telemetry.escalation_protocol}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-surface-container-high text-secondary text-[11px] font-bold">READY</span>
              </div>
            </section>

            <section className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-on-surface">Triage Acuity Distribution</h2>
                <span className="text-[11px] text-on-surface-variant">Live Intake Mix</span>
              </div>
              <div className="flex items-center justify-center py-2">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle className="text-surface-container-high" cx="18" cy="18" fill="transparent" r="14" stroke="currentColor" strokeWidth="3.5" />
                    {acuitySegments.map((segment) => {
                      const dash = segment.value;
                      const offset = donutOffset;
                      donutOffset -= dash;
                      return (
                        <circle
                          key={segment.key}
                          className={segment.stroke}
                          cx="18" cy="18" fill="transparent" r="14"
                          strokeDasharray={`${dash} ${100 - dash}`}
                          strokeDashoffset={offset}
                          strokeWidth="3.5"
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-on-surface leading-none">{kpis.active}</span>
                    <span className="text-[11px] text-on-surface-variant uppercase mt-0.5">In Queue</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {acuitySegments.map((segment) => (
                  <div key={segment.key} className="flex items-center justify-between p-2 bg-surface-container-low rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${segment.stroke.replace("stroke-", "bg-")}`} />
                      <span className="text-xs text-on-surface font-medium">{segment.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-on-surface">{segment.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-on-surface">Live Event Audit Stream</h2>
                <span className="text-[11px] text-primary font-semibold">Last 15 events</span>
              </div>
              <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                {events.map((event) => {
                  const meta = eventMeta(event.type);
                  return (
                    <div key={event.id} className="p-3 bg-surface-container-low rounded-xl flex items-start gap-3">
                      <span className={`material-symbols-outlined text-[20px] ${meta.color}`}>{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-on-surface truncate">{event.title}</span>
                          <span className="text-[10px] text-on-surface-variant whitespace-nowrap">{event.timestamp}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant mt-0.5">{event.detail}</p>
                        <span className="text-[10px] text-secondary font-semibold">{event.cabin}</span>
                      </div>
                    </div>
                  );
                })}
                {events.length === 0 && <p className="text-sm text-on-surface-variant text-center py-4">No fleet events recorded yet.</p>}
              </div>
            </section>

            <section className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-surface-container-low text-primary material-symbols-outlined">sync_saved_locally</span>
                <div>
                  <p className="text-sm font-semibold text-on-surface">HL7 / FHIR Gateway Active</p>
                  <p className="text-xs text-on-surface-variant">0 packet drops • 100% data fidelity</p>
                </div>
              </div>
              <span className="text-[11px] text-primary font-bold bg-secondary-container px-2.5 py-1 rounded-full">Nominal</span>
            </section>
          </div>
        </div>
      </main>

      {isFlushDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-error">Irreversible command</span>
                <h2 className="text-xl font-bold mt-1">Flush Day Tokens?</h2>
                <p className="mt-2 text-sm text-on-surface-variant">This flushes all non-admitted outpatient tickets across the fleet and archives the day&apos;s telemetry. The queue cannot be restored afterwards.</p>
              </div>
              <button onClick={() => setFlushDialogOpen(false)} className="text-on-surface-variant text-xl" aria-label="Close">×</button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setFlushDialogOpen(false)} className="rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-semibold">Cancel</button>
              <button onClick={handleFlush} disabled={isBusy} className="rounded-xl bg-error px-4 py-2.5 text-sm font-bold text-on-error disabled:opacity-60">Confirm Flush</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
