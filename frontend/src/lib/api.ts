// Typed browser client for the OPDQueue FastAPI dispatcher (backend/routers/queue.py).
// Every call falls back to an in-memory mock that mirrors the backend queue rules,
// so the Doctor EHR station stays fully interactive even when the API is offline.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

export type Priority = "routine" | "priority" | "emergency";
export type TokenStatus = "waiting" | "in_consultation" | "hold" | "completed" | "cancelled";

export interface QueueToken {
  id: string;
  token_display: string;
  patient_name: string;
  mrn?: string | null;
  patient_uid?: string | null;
  department: string;
  cabin: string;
  doctor: string;
  priority: Priority;
  status: TokenStatus;
  estimated_wait_mins: number;
  queue_position?: number;
  chief_complaint?: string | null;
  is_emergency_overflow?: boolean;
}

export interface EmergencyReserve {
  capacity: number;
  used: number;
}

export interface QueueSnapshot {
  /** True when the live FastAPI backend answered; false when the local mock was used. */
  online: boolean;
  tokens: QueueToken[];
  emergency_reserve: EmergencyReserve;
}

export interface PrescriptionRow {
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface VisitPayload {
  symptoms: string;
  diagnosis: string;
  blood_pressure?: string;
  pulse?: number;
  temperature?: number;
  oxygen_saturation?: number;
  prescriptions: PrescriptionRow[];
  lab_orders: string[];
}

export interface EmergencyArrivalInput {
  patient_name: string;
  patient_uid?: string | null;
  chief_complaint: string;
  cabin?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const EMERGENCY_RESERVE_CAPACITY = 2;
const REGULAR_CONSULTATION_MINS = 8;
const EMERGENCY_CONSULTATION_MINS = 12;

// ---------------------------------------------------------------------------
// Mock engine (mirrors backend/routers/queue.py rules)
// ---------------------------------------------------------------------------

let mockTokens: QueueToken[] = [
  {
    id: "t-12", token_display: "#12", patient_name: "Johnathan Doe", mrn: "MRN-90248",
    patient_uid: "JOHDOES32101990", department: "Cardiology", cabin: "Cabin 104",
    doctor: "Dr. Sarah Jenkins, MD", priority: "priority", status: "in_consultation",
    estimated_wait_mins: 0, chief_complaint: "Chest discomfort and mild palpitations",
  },
  {
    id: "t-13", token_display: "#13", patient_name: "Priya Sharma", mrn: "MRN-90249",
    department: "Cardiology", cabin: "Cabin 104", doctor: "Dr. Sarah Jenkins, MD",
    priority: "routine", status: "waiting", estimated_wait_mins: 4,
    chief_complaint: "Routine cardiology review",
  },
  {
    id: "t-14", token_display: "#14", patient_name: "Michael Chang", mrn: "MRN-90250",
    department: "Cardiology", cabin: "Cabin 104", doctor: "Dr. Sarah Jenkins, MD",
    priority: "priority", status: "waiting", estimated_wait_mins: 12,
    chief_complaint: "Post-procedure follow-up",
  },
  {
    id: "t-15", token_display: "#15", patient_name: "Aaliyah Khan", mrn: "MRN-90251",
    department: "Cardiology", cabin: "Cabin 104", doctor: "Dr. Sarah Jenkins, MD",
    priority: "routine", status: "waiting", estimated_wait_mins: 20,
    chief_complaint: "Blood pressure follow-up",
  },
];

const mockVisits: VisitPayload[] = [];

function isActive(token: QueueToken): boolean {
  return !["completed", "cancelled"].includes(token.status);
}

function mockRecalculate(cabin = "Cabin 104"): void {
  let remainingMinutes = 0;
  let queuePosition = 0;
  for (const token of mockTokens) {
    if (token.cabin !== cabin || !isActive(token)) continue;
    if (token.status === "in_consultation") {
      token.estimated_wait_mins = 0;
      token.queue_position = 0;
      remainingMinutes = 4;
      continue;
    }
    if (token.status === "hold") continue;
    queuePosition += 1;
    token.queue_position = queuePosition;
    token.estimated_wait_mins = remainingMinutes;
    remainingMinutes += token.priority === "emergency" ? EMERGENCY_CONSULTATION_MINS : REGULAR_CONSULTATION_MINS;
  }
}

function deriveReserve(tokens: QueueToken[]): EmergencyReserve {
  return {
    capacity: EMERGENCY_RESERVE_CAPACITY,
    used: tokens.filter((t) => t.priority === "emergency" && isActive(t)).length,
  };
}

function mockSnapshot(cabin = "Cabin 104"): QueueSnapshot {
  mockRecalculate(cabin);
  const tokens = mockTokens.filter((t) => t.cabin === cabin && isActive(t));
  return { online: false, tokens, emergency_reserve: deriveReserve(tokens) };
}

function mockFind(tokenId: string): QueueToken {
  const token = mockTokens.find((t) => t.id === tokenId);
  if (!token) throw new ApiError(404, "Token not found");
  return token;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Backend unreachable");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new ApiError(response.status, body.detail ?? `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

interface BackendTokenResponse {
  status: string;
  token?: QueueToken;
  tokens?: QueueToken[];
  emergency_reserve?: EmergencyReserve;
  next_token?: QueueToken | null;
  completed_token?: QueueToken;
}

function toSnapshot(data: BackendTokenResponse, fallbackTokens: QueueToken[]): QueueSnapshot {
  const tokens = data.tokens ?? fallbackTokens;
  return { online: true, tokens, emergency_reserve: data.emergency_reserve ?? deriveReserve(tokens) };
}

// ---------------------------------------------------------------------------
// Public API — each function prefers the live backend and falls back to mock
// ---------------------------------------------------------------------------

export async function getQueue(cabin = "Cabin 104"): Promise<QueueSnapshot> {
  try {
    const data = await request<BackendTokenResponse>(`/queue/tokens?cabin=${encodeURIComponent(cabin)}`);
    return toSnapshot(data, []);
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) throw error;
    return mockSnapshot(cabin);
  }
}

export async function callToken(tokenId: string, cabin = "Cabin 104"): Promise<QueueSnapshot> {
  try {
    const data = await request<BackendTokenResponse>(`/queue/tokens/${tokenId}/call`, { method: "POST" });
    return toSnapshot(data, []);
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) throw error;
    const token = mockFind(tokenId);
    if (mockTokens.some((t) => t.status === "in_consultation" && t.id !== tokenId)) {
      throw new ApiError(409, "Complete the current consultation before calling another patient");
    }
    token.status = "in_consultation";
    return mockSnapshot(cabin);
  }
}

export async function holdToken(tokenId: string, cabin = "Cabin 104"): Promise<QueueSnapshot> {
  try {
    const data = await request<BackendTokenResponse>(`/queue/tokens/${tokenId}/hold`, { method: "POST" });
    return toSnapshot(data, []);
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) throw error;
    const token = mockFind(tokenId);
    if (["completed", "cancelled"].includes(token.status)) {
      throw new ApiError(409, "Completed tokens cannot be placed on hold");
    }
    token.status = "hold";
    return mockSnapshot(cabin);
  }
}

export async function resumeToken(tokenId: string, cabin = "Cabin 104"): Promise<QueueSnapshot> {
  try {
    const data = await request<BackendTokenResponse>(`/queue/tokens/${tokenId}/resume`, { method: "POST" });
    return toSnapshot(data, []);
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) throw error;
    const token = mockFind(tokenId);
    if (token.status !== "hold") throw new ApiError(409, "Only held tokens can be resumed");
    token.status = "waiting";
    return mockSnapshot(cabin);
  }
}

export async function completeToken(
  tokenId: string,
  cabin = "Cabin 104",
): Promise<QueueSnapshot & { next_token: QueueToken | null }> {
  try {
    const data = await request<BackendTokenResponse>(`/queue/tokens/${tokenId}/complete`, { method: "POST" });
    return { ...toSnapshot(data, []), next_token: data.next_token ?? null };
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) throw error;
    const token = mockFind(tokenId);
    token.status = "completed";
    const nextToken = mockTokens.find((t) => t.cabin === token.cabin && t.status === "waiting") ?? null;
    if (nextToken) nextToken.status = "in_consultation";
    const snapshot = mockSnapshot(cabin);
    return { ...snapshot, next_token: nextToken && isActive(nextToken) ? nextToken : null };
  }
}

export async function insertEmergency(input: EmergencyArrivalInput): Promise<QueueSnapshot> {
  const cabin = input.cabin ?? "Cabin 104";
  try {
    const data = await request<BackendTokenResponse>("/queue/emergency-arrivals", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return toSnapshot(data, []);
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) throw error;
    const reserveUsed = mockTokens.filter(
      (t) => t.priority === "emergency" && t.cabin === cabin && isActive(t),
    ).length;
    const emergencyNumber = mockTokens.filter((t) => t.priority === "emergency").length + 1;
    const activeIndex = mockTokens.findIndex((t) => t.cabin === cabin && t.status === "in_consultation");
    const token: QueueToken = {
      id: `em-${Math.random().toString(36).slice(2, 10)}`,
      token_display: `E-${String(emergencyNumber).padStart(2, "0")}`,
      patient_name: input.patient_name,
      patient_uid: input.patient_uid ?? null,
      mrn: input.patient_uid ?? "Emergency registration pending",
      department: "Cardiology",
      cabin,
      doctor: "Dr. Sarah Jenkins, MD",
      priority: "emergency",
      status: "waiting",
      estimated_wait_mins: 0,
      chief_complaint: input.chief_complaint,
      is_emergency_overflow: reserveUsed >= EMERGENCY_RESERVE_CAPACITY,
    };
    mockTokens.splice(activeIndex >= 0 ? activeIndex + 1 : 0, 0, token);
    return mockSnapshot(cabin);
  }
}

export async function saveVisit(tokenId: string, visit: VisitPayload): Promise<void> {
  try {
    await request(`/queue/tokens/${tokenId}/visit`, { method: "POST", body: JSON.stringify(visit) });
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) throw error;
    mockFind(tokenId); // 404 surfaces even offline
    mockVisits.push(visit);
  }
}

// ---------------------------------------------------------------------------
// Admin — Master Operations Live Monitor (backend: backend/routers/admin.py by Anti Gravity)
// ---------------------------------------------------------------------------

export type CabinStatus = "active" | "paused" | "on_break" | "emergency";

export interface AdminCabin {
  id: string;
  cabin_number: string;
  department: string;
  wing: string;
  doctor_name: string;
  avatar_initials: string;
  status: CabinStatus;
  serving_token: string | null;
  queue_depth: number;
  avg_velocity_mins: number;
  load_tag: string;
  corridor: string;
}

export interface AdminKpis {
  daily_intake: number;
  completed: number;
  active: number;
  mean_wait_mins: number;
  wait_trend: string;
  wait_threshold: string;
  active_clinician_units: number;
  total_clinician_units: number;
  operating_percentage: number;
  sterilization_hold: number;
  bottleneck: {
    wing: string;
    cabin: string;
    queued: number;
    wait_eta_mins: number;
  };
}

export interface AcuityMix {
  routine: number;
  priority: number;
  emergency: number;
}

export interface AdminEvent {
  id: string;
  type: string;
  title: string;
  detail: string;
  cabin: string;
  timestamp: string;
}

export interface AdminOverview {
  online: boolean;
  kpis: AdminKpis;
  acuity_mix: AcuityMix;
  emergency_telemetry: {
    active_emergencies: number;
    max_reserve_capacity: number;
    latency_to_cabin_mins: number;
    escalation_protocol: string;
  };
}

export interface RebalanceResult {
  shifted_count: number;
  source_cabin: string;
  target_cabin: string;
  mins_saved: number;
}

interface AdminOverviewResponse {
  status: string;
  kpis: AdminKpis;
  acuity_mix: AcuityMix;
  emergency_telemetry: AdminOverview["emergency_telemetry"];
}

interface AdminCabinsResponse {
  status: string;
  cabins: AdminCabin[];
}

interface AdminEventResponse {
  status: string;
  events: AdminEvent[];
}

interface AdminRebalanceResponse {
  status: string;
  shifted_count: number;
  source: AdminCabin;
  target: AdminCabin;
  event: AdminEvent;
}

// --- Admin mock fleet (mirrors backend/routers/admin.py seed) ---------------

let mockCabins: AdminCabin[] = [
  {
    id: "c-101", cabin_number: "Cabin 101", department: "General Medicine", wing: "Wing A",
    doctor_name: "Dr. Sarah Miller, MD", avatar_initials: "SM", status: "active", serving_token: "#GM-38",
    queue_depth: 4, avg_velocity_mins: 7.2, load_tag: "Float Ready", corridor: "Corridor A",
  },
  {
    id: "c-102", cabin_number: "Cabin 102", department: "Pediatrics", wing: "Wing B",
    doctor_name: "Dr. Alex Rivera, MD", avatar_initials: "AR", status: "active", serving_token: "#PD-41",
    queue_depth: 18, avg_velocity_mins: 11.4, load_tag: "High Load", corridor: "Corridor B",
  },
  {
    id: "c-103", cabin_number: "Cabin 103", department: "Dermatology", wing: "Wing B",
    doctor_name: "Dr. Emily Chen, MD", avatar_initials: "EC", status: "active", serving_token: "#DM-19",
    queue_depth: 6, avg_velocity_mins: 8.8, load_tag: "Balanced", corridor: "Corridor B",
  },
  {
    id: "c-104", cabin_number: "Cabin 104", department: "Cardiology", wing: "Wing A",
    doctor_name: "Dr. Sarah Jenkins, MD", avatar_initials: "SJ", status: "active", serving_token: "#CARD-042",
    queue_depth: 5, avg_velocity_mins: 9.1, load_tag: "Optimal", corridor: "Corridor B",
  },
  {
    id: "c-105", cabin_number: "Cabin 105", department: "Orthopedics", wing: "Wing B",
    doctor_name: "Dr. Marcus Vance, MD", avatar_initials: "MV", status: "active", serving_token: "#OR-22",
    queue_depth: 8, avg_velocity_mins: 14.2, load_tag: "Balanced", corridor: "Corridor B",
  },
  {
    id: "c-106", cabin_number: "Cabin 106", department: "ENT", wing: "Wing C",
    doctor_name: "Dr. Priya Nair, MD", avatar_initials: "PN", status: "on_break", serving_token: "#ENT-14",
    queue_depth: 0, avg_velocity_mins: 0, load_tag: "Break", corridor: "Corridor C",
  },
];

const mockAdminEvents: AdminEvent[] = [
  {
    id: "ev-01", type: "emergency_insertion", title: "Emergency Token E-01 Fast-Tracked",
    detail: "Patient placed next in consultation order for Cabin 104. Wait times adjusted.",
    cabin: "Cabin 104", timestamp: "3 mins ago",
  },
  {
    id: "ev-02", type: "status_change", title: "Cabin 106 Sterilization Break",
    detail: "Dr. Priya Nair scheduled rotation break until 12:00 PM.",
    cabin: "Cabin 106", timestamp: "14 mins ago",
  },
  {
    id: "ev-03", type: "rebalance", title: "Dynamic Load Shift Executed",
    detail: "Transferred 4 routine overflow tokens from Wing B to Wing A.",
    cabin: "Cabin 102 → 101", timestamp: "28 mins ago",
  },
];

function adminOffline(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

function deriveMockOverview(): AdminOverview {
  const activeCabins = mockCabins.filter((c) => c.status === "active");
  const totalQueued = mockCabins.reduce((sum, c) => sum + c.queue_depth, 0);
  const busiest = [...mockCabins].sort((a, b) => b.queue_depth - a.queue_depth)[0];
  return {
    online: false,
    kpis: {
      daily_intake: 418,
      completed: 312,
      active: totalQueued,
      mean_wait_mins: 24,
      wait_trend: "-12.4% today",
      wait_threshold: "< 30 min",
      active_clinician_units: activeCabins.length,
      total_clinician_units: mockCabins.length,
      operating_percentage: Math.round((activeCabins.length / mockCabins.length) * 1000) / 10,
      sterilization_hold: mockCabins.filter((c) => c.status === "on_break").length,
      bottleneck: {
        wing: `Wing B ${busiest.department}`,
        cabin: busiest.cabin_number,
        queued: busiest.queue_depth,
        wait_eta_mins: Math.round(busiest.queue_depth * busiest.avg_velocity_mins),
      },
    },
    acuity_mix: { routine: 68, priority: 22, emergency: 10 },
    emergency_telemetry: {
      active_emergencies: 2,
      max_reserve_capacity: 2,
      latency_to_cabin_mins: 3.2,
      escalation_protocol: "Tier 1 Active",
    },
  };
}

export async function getAdminOverview(): Promise<AdminOverview> {
  try {
    const data = await request<AdminOverviewResponse>("/admin/overview");
    return { online: true, kpis: data.kpis, acuity_mix: data.acuity_mix, emergency_telemetry: data.emergency_telemetry };
  } catch (error) {
    if (!adminOffline(error)) throw error;
    return deriveMockOverview();
  }
}

export async function getCabins(wing?: string): Promise<AdminCabin[]> {
  try {
    const data = await request<AdminCabinsResponse>(`/admin/cabins${wing ? `?wing=${encodeURIComponent(wing)}` : ""}`);
    return data.cabins;
  } catch (error) {
    if (!adminOffline(error)) throw error;
    return wing && wing !== "all" ? mockCabins.filter((c) => c.wing.toLowerCase().includes(wing.toLowerCase())) : [...mockCabins];
  }
}

export async function updateCabinStatus(cabinId: string, status: CabinStatus): Promise<{ cabin: AdminCabin; event: AdminEvent | null }> {
  try {
    const data = await request<{ status: string; cabin: AdminCabin; event: AdminEvent }>(
      `/admin/cabins/${encodeURIComponent(cabinId)}/status`,
      { method: "POST", body: JSON.stringify({ status }) },
    );
    return { cabin: data.cabin, event: data.event ?? null };
  } catch (error) {
    if (!adminOffline(error)) throw error;
    const cabin = mockCabins.find((c) => c.id === cabinId || c.cabin_number.toLowerCase() === cabinId.toLowerCase());
    if (!cabin) throw new ApiError(404, "Cabin not found");
    const oldStatus = cabin.status;
    cabin.status = status;
    cabin.load_tag = status === "on_break" ? "Break" : status === "emergency" ? "Code Red" : status === "paused" ? "Paused" : cabin.queue_depth <= 6 ? "Optimal" : "High Load";
    const event: AdminEvent = {
      id: `ev-${Math.random().toString(36).slice(2, 8)}`, type: "status_change",
      title: `${cabin.cabin_number} Status Shift`, detail: `Status changed from ${oldStatus} to ${status}.`,
      cabin: cabin.cabin_number, timestamp: "Just now",
    };
    mockAdminEvents.unshift(event);
    return { cabin, event };
  }
}

export async function triggerRebalance(options?: { source_cabin_id?: string; target_cabin_id?: string; tokens_to_shift?: number }): Promise<RebalanceResult> {
  try {
    const data = await request<AdminRebalanceResponse>("/admin/rebalance", {
      method: "POST",
      body: JSON.stringify({
        source_cabin_id: options?.source_cabin_id ?? null,
        target_cabin_id: options?.target_cabin_id ?? null,
        tokens_to_shift: options?.tokens_to_shift ?? 4,
      }),
    });
    return {
      shifted_count: data.shifted_count,
      source_cabin: data.source.cabin_number,
      target_cabin: data.target.cabin_number,
      mins_saved: Math.round(data.shifted_count * 3.5),
    };
  } catch (error) {
    if (!adminOffline(error)) throw error;
    const sourceId = options?.source_cabin_id ?? "c-102";
    const targetId = options?.target_cabin_id ?? "c-101";
    const source = mockCabins.find((c) => c.id === sourceId)!;
    const target = mockCabins.find((c) => c.id === targetId)!;
    const shiftCount = Math.min(options?.tokens_to_shift ?? 4, source.queue_depth);
    source.queue_depth = Math.max(0, source.queue_depth - shiftCount);
    target.queue_depth += shiftCount;
    source.load_tag = source.queue_depth <= 8 ? "Optimal" : "High Load";
    target.load_tag = target.queue_depth <= 8 ? "Balanced" : "High Load";
    const event: AdminEvent = {
      id: `ev-${Math.random().toString(36).slice(2, 8)}`, type: "rebalance", title: "Fleet Rebalance Executed",
      detail: `Transferred ${shiftCount} routine tokens from ${source.cabin_number} to ${target.cabin_number}.`,
      cabin: `${source.cabin_number} → ${target.cabin_number}`, timestamp: "Just now",
    };
    mockAdminEvents.unshift(event);
    return { shifted_count: shiftCount, source_cabin: source.cabin_number, target_cabin: target.cabin_number, mins_saved: Math.round(shiftCount * 3.5) };
  }
}

export async function flushDayTokens(): Promise<{ message: string; event: AdminEvent | null }> {
  try {
    const data = await request<{ status: string; message: string; event: AdminEvent }>("/admin/flush", { method: "POST" });
    return { message: data.message, event: data.event ?? null };
  } catch (error) {
    if (!adminOffline(error)) throw error;
    const event: AdminEvent = {
      id: `ev-${Math.random().toString(36).slice(2, 8)}`, type: "flush", title: "Day Tokens Flushed & Archived",
      detail: "Historical tokens reconciled. Telemetry active stream flushed for night cycle.",
      cabin: "Global Fleet", timestamp: "Just now",
    };
    mockAdminEvents.unshift(event);
    return { message: "Fleet tokens successfully flushed", event };
  }
}

export async function getAdminEvents(): Promise<AdminEvent[]> {
  try {
    const data = await request<AdminEventResponse>("/admin/events");
    return data.events;
  } catch (error) {
    if (!adminOffline(error)) throw error;
    return mockAdminEvents.slice(0, 15);
  }
}

export async function callNextAtCabin(cabinNumber: string): Promise<QueueSnapshot> {
  try {
    const data = await request<BackendTokenResponse>(`/queue/call-next?cabin=${encodeURIComponent(cabinNumber)}`, { method: "POST" });
    return toSnapshot(data, []);
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) throw error;
    if (mockTokens.some((t) => t.cabin === cabinNumber && t.status === "in_consultation")) {
      throw new ApiError(409, "Complete the current consultation before calling another patient");
    }
    const next = mockTokens.find((t) => t.cabin === cabinNumber && t.status === "waiting");
    if (!next) throw new ApiError(404, "No waiting tokens in this cabin queue");
    next.status = "in_consultation";
    return mockSnapshot(cabinNumber);
  }
}


