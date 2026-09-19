import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock-opdqueue.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface QueueToken {
  id: string;
  token_display: string;
  sequence_number: number;
  patient_id?: string;
  department_id?: string;
  cabin_id?: string;
  doctor_id?: string;
  priority: "routine" | "priority" | "emergency";
  status: "waiting" | "in_consultation" | "completed" | "hold" | "cancelled";
  chief_complaint?: string;
  estimated_wait_mins: number;
  called_at?: string;
  created_at?: string;
}

export interface Cabin {
  id: string;
  cabin_number: string;
  department_name: string;
  current_doctor_name: string;
  status: "active" | "paused" | "on_break" | "emergency";
  serving_token_number: string;
  corridor: string;
}
