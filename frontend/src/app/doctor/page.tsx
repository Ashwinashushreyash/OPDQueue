"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import {
  ApiError,
  QueueSnapshot,
  QueueToken,
  PrescriptionRow,
  callToken,
  completeToken,
  getQueue,
  holdToken,
  insertEmergency,
  resumeToken,
  saveVisit,
} from "@/lib/api";

const LAB_CATALOG = [
  "Complete Blood Count",
  "Fasting Blood Sugar & HbA1c",
  "Chest X-Ray",
  "Serum Electrolytes",
  "ECG / 12-Lead",
  "Serum IgE & Allergy Screen",
];

const SYMPTOM_CHIPS = ["Chest tightness", "Mild fever 2d", "Persistent cough", "Hypertension follow-up"];

const statusLabel: Record<QueueToken["status"], string> = {
  waiting: "Waiting",
  in_consultation: "In Cabin",
  hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const EMPTY_RX: PrescriptionRow = { medication_name: "", dosage: "", frequency: "", duration: "", instructions: "" };

const DEFAULT_VITALS = { blood_pressure: "128/82", pulse: "76", temperature: "98.6", oxygen_saturation: "99" };

function priorityLabel(entry: QueueToken): string {
  if (entry.priority === "emergency") return entry.is_emergency_overflow ? "Emergency overflow" : "Emergency reserve";
  if (entry.priority === "priority") return "Priority follow-up";
  return "Routine";
}

function formatCallTime(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function DoctorPage() {
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorNotice, setErrorNotice] = useState("");

  // Clinical form state (Section 1-4)
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [vitals, setVitals] = useState(DEFAULT_VITALS);
  const [rxRows, setRxRows] = useState<PrescriptionRow[]>([]);
  const [selectedLabs, setSelectedLabs] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  // Emergency dialog state
  const [isEmergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyUid, setEmergencyUid] = useState("");
  const [emergencyReason, setEmergencyReason] = useState("");

  const isMutatingRef = useRef(false);

  const activeQueue = useMemo(
    () => snapshot?.tokens.filter((entry) => entry.status !== "completed") ?? [],
    [snapshot],
  );
  const currentPatient = useMemo(
    () => activeQueue.find((entry) => entry.status === "in_consultation") ?? activeQueue.find((e) => e.status === "waiting"),
    [activeQueue],
  );
  const emergencyUsed = snapshot?.emergency_reserve.used ?? 0;
  const emergencyCapacity = snapshot?.emergency_reserve.capacity ?? 2;
  const waitingCount = activeQueue.filter((entry) => entry.status === "waiting").length;

  const refreshQueue = useCallback(async () => {
    if (isMutatingRef.current) return;
    try {
      setSnapshot(await getQueue());
    } catch (error) {
      setErrorNotice(error instanceof ApiError ? error.message : "Could not reach the queue service.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
    const interval = window.setInterval(() => void refreshQueue(), 15000);
    return () => window.clearInterval(interval);
  }, [refreshQueue]);

  // Reset the clinical form whenever the cabin switches to a different patient.
  useEffect(() => {
    if (!currentPatient) return;
    setSymptoms(currentPatient.chief_complaint ?? "");
    setDiagnosis("");
    setVitals(DEFAULT_VITALS);
    setRxRows([]);
    setSelectedLabs([]);
    setSaved(false);
  }, [currentPatient?.id]);

  function runAction(action: () => Promise<void>) {
    if (isBusy) return;
    setIsBusy(true);
    isMutatingRef.current = true;
    setErrorNotice("");
    action()
      .then(() => setSaved(false))
      .catch((error: unknown) => {
        setErrorNotice(error instanceof ApiError ? error.message : "Queue action failed. Is the backend running?");
      })
      .finally(() => {
        isMutatingRef.current = false;
        setIsBusy(false);
        void refreshQueue();
      });
  }

  function callNextPatient() {
    const next = activeQueue.find((entry) => entry.status === "waiting");
    if (!next) {
      setNotice("No patients are waiting right now.");
      return;
    }
    runAction(async () => {
      const updated = await callToken(next.id);
      setSnapshot(updated);
      setNotice(`${next.token_display} • ${next.patient_name} has been called to Cabin 104 at ${formatCallTime()}.`);
    });
  }

  function toggleHold(entry: QueueToken) {
    runAction(async () => {
      const updated = entry.status === "hold" ? await resumeToken(entry.id) : await holdToken(entry.id);
      setSnapshot(updated);
      setNotice(entry.status === "hold" ? `${entry.token_display} resumed in the live queue.` : `${entry.token_display} placed on hold — ETAs recalculated.`);
    });
  }

  function handleEmergencySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runAction(async () => {
      const updated = await insertEmergency({
        patient_name: emergencyName.trim(),
        patient_uid: emergencyUid.trim() || null,
        chief_complaint: emergencyReason.trim(),
      });
      setSnapshot(updated);
      const inserted = updated.tokens.find(
        (entry) => entry.priority === "emergency" && entry.patient_name === emergencyName.trim(),
      );
      setNotice(
        `${inserted?.token_display ?? "Emergency token"} inserted after the consultation in progress. Regular patient ETAs updated.` +
          (inserted?.is_emergency_overflow ? " Emergency reserve is now exceeded." : ""),
      );
      setEmergencyDialogOpen(false);
      setEmergencyName("");
      setEmergencyUid("");
      setEmergencyReason("");
    });
  }

  function validateVisit(): string | null {
    if (!currentPatient) return "No patient is currently in the cabin.";
    if (symptoms.trim().length < 2) return "Record the symptoms before saving the visit.";
    if (diagnosis.trim().length < 2) return "A provisional diagnosis is required before completing the visit.";
    if (!/^\d{2,3}\/\d{2,3}$/.test(vitals.blood_pressure.trim())) return "Blood pressure must look like 128/82.";
    const pulse = Number(vitals.pulse);
    if (!Number.isFinite(pulse) || pulse < 0 || pulse > 300) return "Pulse must be between 0 and 300 bpm.";
    const temperature = Number(vitals.temperature);
    if (!Number.isFinite(temperature) || temperature < 80 || temperature > 120) return "Temperature must be between 80 and 120 °F.";
    const spo2 = Number(vitals.oxygen_saturation);
    if (!Number.isFinite(spo2) || spo2 < 0 || spo2 > 100) return "SpO2 must be between 0 and 100%.";
    if (rxRows.some((row) => !row.medication_name.trim() || !row.dosage.trim())) return "Every prescription row needs a medicine name and dosage.";
    return null;
  }

  function completeVisit() {
    const validationError = validateVisit();
    if (validationError) {
      setErrorNotice(validationError);
      return;
    }
    const finishing = currentPatient!;
    runAction(async () => {
      await saveVisit(finishing.id, {
        symptoms: symptoms.trim(),
        diagnosis: diagnosis.trim(),
        blood_pressure: vitals.blood_pressure.trim(),
        pulse: Number(vitals.pulse),
        temperature: Number(vitals.temperature),
        oxygen_saturation: Number(vitals.oxygen_saturation),
        prescriptions: rxRows.filter((row) => row.medication_name.trim()),
        lab_orders: selectedLabs,
      });
      const result = await completeToken(finishing.id);
      setSnapshot(result);
      setSaved(true);
      setNotice(
        result.next_token
          ? `Visit saved for ${finishing.token_display}. ${result.next_token.token_display} • ${result.next_token.patient_name} has been called to Cabin 104.`
          : `Visit saved for ${finishing.token_display}. No patients are waiting.`,
      );
    });
  }

  function toggleLab(lab: string) {
    setSelectedLabs((currentLabs) =>
      currentLabs.includes(lab) ? currentLabs.filter((item) => item !== lab) : [...currentLabs, lab],
    );
  }

  function updateRxRow(index: number, patch: Partial<PrescriptionRow>) {
    setRxRows((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
          <span className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-semibold">Syncing Cabin 104 telemetry…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <Header
        activeToken={currentPatient?.token_display ?? "—"}
        estimatedWait={`${waitingCount} waiting`}
        role="doctor"
        userName="Dr. Sarah Jenkins"
        userIdentifier="Cabin 104"
        userInitials="SJ"
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        {/* Station banner */}
        <section className="bg-surface-container-lowest border border-surface-container-high/60 rounded-2xl p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-headline-sm font-bold">SJ</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-headline-sm text-xl font-bold text-on-surface">Dr. Sarah Jenkins, MD</h1>
                <span className="rounded-full bg-secondary-container text-on-secondary-container px-2.5 py-1 text-xs font-semibold">Cabin 104 • Wing 3</span>
              </div>
              <p className="text-sm text-on-surface-variant mt-1">Cardiology & General Medicine OPD • Live EHR station</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                snapshot?.online ? "bg-primary-fixed text-on-primary-fixed-variant" : "bg-surface-container-high text-on-surface-variant"
              }`}
              title={snapshot?.online ? "Connected to the FastAPI dispatcher" : "Backend offline — local simulation active"}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${snapshot?.online ? "bg-primary animate-pulse" : "bg-outline-variant"}`} />
              {snapshot?.online ? "Live API" : "Offline simulation"}
            </span>
            <div className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface">
              <span className="text-xs uppercase tracking-wide text-secondary font-semibold">Current OPD slot</span>
              <p className="font-semibold mt-0.5">Morning B (11:30 AM – 02:30 PM)</p>
            </div>
          </div>
        </section>

        {errorNotice && (
          <div className="mt-5 rounded-xl border border-error/30 bg-error-container px-4 py-3 flex items-start gap-3 text-sm text-on-error-container">
            <span className="material-symbols-outlined text-error">warning</span>
            <div className="flex-1"><strong>Action blocked.</strong> {errorNotice}</div>
            <button onClick={() => setErrorNotice("")} className="text-on-error-container" aria-label="Dismiss error">×</button>
          </div>
        )}
        {notice && (
          <div className="mt-5 rounded-xl border border-tertiary/20 bg-tertiary-fixed px-4 py-3 flex items-start gap-3 text-sm text-on-tertiary-fixed">
            <span className="material-symbols-outlined text-tertiary">sync</span>
            <div className="flex-1"><strong>Queue updated.</strong> {notice}</div>
            <button onClick={() => setNotice("")} className="text-on-tertiary-fixed" aria-label="Dismiss queue update">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
          {/* Left column: dispatcher + live queue */}
          <aside className="xl:col-span-4 flex flex-col gap-5">
            <section className="bg-surface-container-lowest border border-surface-container-high/60 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-secondary">OPD slot</span>
                <span className="text-xs font-semibold text-primary">Tier-1 on schedule</span>
              </div>
              <select className="w-full mt-3 rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2.5 text-sm font-semibold text-on-surface">
                <option>Morning B (11:30 AM – 02:30 PM)</option>
              </select>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div><p className="text-xs text-on-surface-variant">Serving</p><p className="text-2xl font-bold text-primary">{activeQueue.some((e) => e.status === "in_consultation") ? 1 : 0}</p></div>
                <div><p className="text-xs text-on-surface-variant">Waiting</p><p className="text-2xl font-bold text-on-surface">{waitingCount}</p></div>
                <div><p className="text-xs text-on-surface-variant">Emergency</p><p className="text-2xl font-bold text-error">{emergencyUsed}/{emergencyCapacity}</p></div>
              </div>
            </section>

            <section className="bg-surface-container-lowest border border-surface-container-high/60 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3"><h2 className="font-title-md font-bold">Triage Dispatcher</h2><span className="text-xs text-secondary font-semibold">Fast dial</span></div>
              <button
                onClick={callNextPatient}
                disabled={isBusy}
                className="w-full bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary rounded-xl px-4 py-3 font-semibold flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2"><span className="material-symbols-outlined">notifications_active</span>Call Next Patient</span>
                <span className="rounded-full bg-on-primary/20 px-2 py-0.5 text-xs">{activeQueue.find((entry) => entry.status === "waiting")?.token_display ?? "—"}</span>
              </button>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <button
                  onClick={() => currentPatient && toggleHold(currentPatient)}
                  disabled={isBusy || !currentPatient}
                  className="rounded-xl bg-surface-container-high px-3 py-3 font-semibold text-sm text-on-surface disabled:opacity-60"
                >
                  {currentPatient?.status === "hold" ? "Resume Patient" : "Hold Current"}
                </button>
                <button
                  onClick={() => setEmergencyDialogOpen(true)}
                  disabled={isBusy}
                  className="rounded-xl bg-error hover:bg-on-error-container px-3 py-3 font-bold text-sm text-on-error transition-colors disabled:opacity-60"
                >
                  Emergency ({Math.max(0, emergencyCapacity - emergencyUsed)} left)
                </button>
              </div>
              <p className="mt-3 text-xs text-on-surface-variant">Physical arrival only. No digital emergency verification is required.</p>
            </section>

            <section className="bg-surface-container-lowest border border-surface-container-high/60 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="font-title-md font-bold">Real-Time Queue Stream</h2><span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs font-bold text-on-secondary-fixed">Live {activeQueue.length}</span></div>
              <div className="mt-4 space-y-2.5">
                {activeQueue.map((entry) => (
                  <div key={entry.id} className={`rounded-xl p-3 border ${entry.priority === "emergency" ? "border-error/30 bg-error-container/40" : entry.status === "in_consultation" ? "border-primary/30 bg-primary/10" : "border-surface-container-high bg-surface-container-low"}`}>
                    <div className="flex items-start gap-3">
                      <span className={`rounded-lg px-2 py-1 text-sm font-bold ${entry.priority === "emergency" ? "bg-error text-on-error" : "bg-surface-container-highest text-primary"}`}>{entry.token_display}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><span className="font-semibold text-sm text-on-surface truncate">{entry.patient_name}</span><span className="rounded-full bg-surface-container-lowest px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">{statusLabel[entry.status]}</span></div>
                        <p className="text-xs text-on-surface-variant mt-1 truncate">{entry.chief_complaint}</p>
                        <div className="flex justify-between mt-2 text-xs">
                          <span className={entry.priority === "emergency" ? "font-bold text-error" : "text-secondary"}>{priorityLabel(entry)}</span>
                          <span className="font-medium text-on-surface">{entry.status === "in_consultation" ? "Inside cabin" : entry.status === "hold" ? "Paused" : `Wait: ${entry.estimated_wait_mins} min`}</span>
                        </div>
                        {(entry.status === "waiting" || entry.status === "hold") && (
                          <button onClick={() => toggleHold(entry)} disabled={isBusy} className="mt-2 text-[11px] font-semibold text-secondary hover:text-primary disabled:opacity-50">
                            {entry.status === "hold" ? "Resume in queue" : "Place on hold"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {activeQueue.length === 0 && <p className="text-sm text-on-surface-variant py-6 text-center">Queue is clear — issue tokens from the patient portal.</p>}
              </div>
            </section>
          </aside>

          {/* Right column: EHR workspace */}
          <section className="xl:col-span-8 flex flex-col gap-5">
            <div className="bg-surface-container-lowest border border-surface-container-high/60 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div><p className="text-xs uppercase tracking-wide font-bold text-secondary">Current patient</p><h2 className="font-headline-sm text-2xl font-bold mt-1">{currentPatient?.patient_name ?? "Queue clear"}</h2><p className="text-sm text-on-surface-variant mt-1">{currentPatient ? `${currentPatient.priority === "emergency" ? "Emergency intake" : "Registered OPD"} • MRN: ${currentPatient.mrn ?? "—"}` : "Call the next patient to begin."}</p></div>
                <div className="flex flex-wrap gap-2"><span className="rounded-full bg-primary-fixed px-3 py-1.5 text-xs font-semibold text-on-primary-fixed-variant">Blood Group: O+ Positive</span><span className="rounded-full bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface-variant">+1 (555) 234-8901</span></div>
              </div>
              <button className="mt-4 rounded-xl bg-secondary-container/50 px-4 py-2 text-sm font-semibold text-primary">Open Past History & Labs (3 Visits)</button>
            </div>

            {/* Section 1: Symptoms */}
            <div className="bg-surface-container-lowest border border-surface-container-high/60 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4"><h2 className="font-title-md font-bold">Section 1: Symptoms & Chief Complaints</h2><span className="text-xs text-secondary">Clinical record</span></div>
              <div className="flex flex-wrap gap-2 mt-3">{SYMPTOM_CHIPS.map((item) => <button key={item} onClick={() => setSymptoms((current) => `${current} ${item}.`.trimStart())} className="rounded-full bg-surface-container-low px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container">+ {item}</button>)}</div>
              <textarea value={symptoms} onChange={(event) => setSymptoms(event.target.value)} className="mt-4 min-h-28 w-full rounded-xl border border-surface-container-high bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none" />
            </div>

            {/* Section 2: Diagnosis & editable vitals */}
            <div className="bg-surface-container-lowest border border-surface-container-high/60 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="font-title-md font-bold">Section 2: Diagnosis & Telemetric Vitals</h2><span className="rounded-full bg-secondary-container px-2 py-1 text-xs font-semibold text-on-secondary-fixed">Editable intake</span></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {([
                  ["Blood pressure", "blood_pressure", "mmHg"],
                  ["Pulse rate", "pulse", "bpm"],
                  ["Body temp", "temperature", "°F"],
                  ["SpO2 oxygen", "oxygen_saturation", "%"],
                ] as const).map(([label, key, unit]) => (
                  <div key={key} className="rounded-xl bg-surface-container-low p-3">
                    <p className="text-[11px] uppercase text-on-surface-variant">{label}</p>
                    <div className="mt-1 flex items-baseline gap-1">
                      <input
                        value={vitals[key]}
                        onChange={(event) => setVitals((current) => ({ ...current, [key]: event.target.value }))}
                        inputMode={key === "blood_pressure" ? "text" : "numeric"}
                        aria-label={`${label} value`}
                        className="w-full bg-transparent text-xl font-bold text-on-surface focus:outline-none"
                      />
                      <span className="text-xs font-medium text-on-surface-variant">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} placeholder="Primary provisional diagnosis…" className="mt-4 w-full rounded-xl border border-surface-container-high bg-surface-container-low p-3 text-sm font-medium text-on-surface focus:border-primary focus:outline-none" aria-label="Primary provisional diagnosis" />
            </div>

            {/* Section 3: Rx builder */}
            <div className="bg-surface-container-lowest border border-surface-container-high/60 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="font-title-md font-bold">Section 3: Rx Prescription Builder</h2><button onClick={() => setRxRows((rows) => [...rows, { ...EMPTY_RX }])} className="text-sm font-semibold text-primary">+ Add Medicine</button></div>
              {rxRows.length === 0 ? (
                <p className="mt-4 text-sm text-on-surface-variant">No medicines added yet — use “+ Add Medicine” to build the prescription.</p>
              ) : (
                <div className="overflow-x-auto mt-4"><table className="w-full min-w-[680px] text-sm">
                  <thead className="text-left text-xs uppercase text-on-surface-variant"><tr><th className="pb-2">Medicine</th><th className="pb-2">Dosage</th><th className="pb-2">Frequency</th><th className="pb-2">Duration</th><th className="pb-2">Instructions</th><th className="pb-2" /></tr></thead>
                  <tbody>
                    {rxRows.map((row, index) => (
                      <tr key={index} className="border-t border-surface-container-high">
                        {(["medication_name", "dosage", "frequency", "duration", "instructions"] as const).map((field) => (
                          <td key={field} className="py-2 pr-2">
                            <input value={row[field]} onChange={(event) => updateRxRow(index, { [field]: event.target.value })} placeholder={field === "medication_name" ? "e.g. Amoxicillin 625mg" : ""} aria-label={`Prescription ${field.replace("_", " ")}`} className="w-full min-w-24 rounded-lg bg-surface-container-low px-2 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none border border-transparent focus:border-surface-container-high" />
                          </td>
                        ))}
                        <td className="py-2"><button onClick={() => setRxRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="text-error text-xs font-semibold" aria-label="Remove medicine row">Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>

            {/* Section 4: Lab orders + save */}
            <div className="bg-surface-container-lowest border border-surface-container-high/60 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="font-title-md font-bold">Section 4: Diagnostic & Laboratory Orders</h2><span className="text-xs text-secondary">Routes to Central Diagnostic Lab</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">{LAB_CATALOG.map((lab) => <label key={lab} className="flex gap-3 rounded-xl bg-surface-container-low p-3 text-sm cursor-pointer"><input type="checkbox" checked={selectedLabs.includes(lab)} onChange={() => toggleLab(lab)} className="mt-0.5 accent-primary" /><span><strong className="block">{lab}</strong><span className="text-xs text-on-surface-variant">Clinical diagnostic order</span></span></label>)}</div>
              <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button disabled={isBusy} className="rounded-xl bg-surface-container-high px-4 py-3 text-sm font-semibold text-on-surface disabled:opacity-60">Print Draft Summary</button>
                <button onClick={completeVisit} disabled={isBusy || !currentPatient} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-60">
                  {saved ? "Visit Saved • Next Patient Called" : "Save & Complete Visit (Advance to Next Patient)"} →
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {isEmergencyDialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/45 p-4"><form onSubmit={handleEmergencySubmit} className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-wide text-error">Physical arrival</span><h2 className="font-headline-sm text-xl font-bold mt-1">Add Emergency Patient</h2><p className="mt-2 text-sm text-on-surface-variant">This inserts the patient after the consultation in progress. No separate digital verification is required.</p></div><button type="button" onClick={() => setEmergencyDialogOpen(false)} className="text-on-surface-variant text-xl" aria-label="Close">×</button></div><div className="mt-5 space-y-4"><label className="block text-sm font-semibold">Patient name<input required value={emergencyName} onChange={(event) => setEmergencyName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-surface-container-high p-3 font-normal focus:border-primary focus:outline-none" placeholder="Name as provided at arrival" /></label><label className="block text-sm font-semibold">Existing UID <span className="font-normal text-on-surface-variant">(optional)</span><input value={emergencyUid} onChange={(event) => setEmergencyUid(event.target.value)} className="mt-1.5 w-full rounded-xl border border-surface-container-high p-3 font-normal focus:border-primary focus:outline-none" placeholder="Look up later if unavailable" /></label><label className="block text-sm font-semibold">Arrival concern<textarea required value={emergencyReason} onChange={(event) => setEmergencyReason(event.target.value)} className="mt-1.5 min-h-24 w-full rounded-xl border border-surface-container-high p-3 font-normal focus:border-primary focus:outline-none" placeholder="Brief physical arrival note" /></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEmergencyDialogOpen(false)} className="rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="submit" disabled={isBusy} className="rounded-xl bg-error px-4 py-2.5 text-sm font-bold text-on-error disabled:opacity-60">Insert Emergency Next</button></div></form></div>}
    </div>
  );
}
