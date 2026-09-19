-- ==============================================================================
-- OPDQueue - Supabase PostgreSQL Schema & Realtime Setup
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'admin');
CREATE TYPE token_priority AS ENUM ('routine', 'priority', 'emergency');
CREATE TYPE token_status AS ENUM ('waiting', 'in_consultation', 'completed', 'hold', 'cancelled');
CREATE TYPE cabin_status AS ENUM ('active', 'paused', 'on_break', 'emergency');
CREATE TYPE appointment_window AS ENUM ('Morning A', 'Morning B', 'Evening A', 'Evening B');

-- 2. PROFILES (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'patient',
    mrn TEXT UNIQUE, -- Medical Record Number for patients (e.g. MRN-90248)
    uid_code TEXT, -- e.g. JOHDOES32101990
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DEPARTMENTS & WINGS
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE, -- e.g. 'CARD', 'GM', 'PD', 'DERM', 'ORTHO', 'ENT'
    wing TEXT NOT NULL,        -- 'Wing A', 'Wing B', 'Wing C', 'Trauma'
    description TEXT,
    floor TEXT DEFAULT '1st Floor',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CABINS / CONSULTATION ROOMS
CREATE TABLE IF NOT EXISTS cabins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cabin_number TEXT NOT NULL UNIQUE, -- e.g. 'Cabin 104'
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    current_doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status cabin_status DEFAULT 'active',
    current_token_id UUID,
    serving_token_number TEXT,
    corridor TEXT DEFAULT 'Corridor B',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. QUEUE TOKENS
CREATE TABLE IF NOT EXISTS queue_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_display TEXT NOT NULL, -- e.g. '#CARD-042' or '#12'
    sequence_number INT NOT NULL,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    cabin_id UUID REFERENCES cabins(id) ON DELETE SET NULL,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    priority token_priority DEFAULT 'routine',
    status token_status DEFAULT 'waiting',
    chief_complaint TEXT,
    estimated_wait_mins INT DEFAULT 15,
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint for cabins current_token_id
ALTER TABLE cabins 
    ADD CONSTRAINT fk_cabins_current_token 
    FOREIGN KEY (current_token_id) 
    REFERENCES queue_tokens(id) 
    ON DELETE SET NULL;

-- 6. APPOINTMENTS / FOLLOW-UPS
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    time_window appointment_window NOT NULL,
    status TEXT DEFAULT 'confirmed',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PATIENT VITALS & EHR RECORDS
CREATE TABLE IF NOT EXISTS patient_vitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES queue_tokens(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    blood_pressure TEXT DEFAULT '120/80',
    pulse INT DEFAULT 72,
    temp NUMERIC(4, 1) DEFAULT 98.6,
    oxygen_sat INT DEFAULT 99,
    weight NUMERIC(5, 1) DEFAULT 74.0,
    bmi NUMERIC(4, 1) DEFAULT 23.8,
    is_verified BOOLEAN DEFAULT TRUE,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PRESCRIPTIONS
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES queue_tokens(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    duration TEXT NOT NULL,
    instructions TEXT,
    in_stock BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CLINICAL VISITS & LABORATORY ORDERS
CREATE TABLE IF NOT EXISTS clinical_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES queue_tokens(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    symptoms TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visit_id UUID REFERENCES clinical_visits(id) ON DELETE CASCADE,
    token_id UUID REFERENCES queue_tokens(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ordered',
    ordered_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. DYNAMIC QUEUE FIELDS & AUDIT EVENTS
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS opd_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS time_window appointment_window;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS queue_order NUMERIC(12,4);
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS queue_position INT;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS expected_duration_mins INT DEFAULT 8;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS is_emergency_overflow BOOLEAN DEFAULT FALSE;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS inserted_after_token_id UUID REFERENCES queue_tokens(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS queue_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    cabin_id UUID REFERENCES cabins(id) ON DELETE SET NULL,
    token_id UUID REFERENCES queue_tokens(id) ON DELETE SET NULL,
    inserted_after_token_id UUID REFERENCES queue_tokens(id) ON DELETE SET NULL,
    caused_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- Enable supabase realtime for instant synchronization across all screens
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE cabins;
ALTER PUBLICATION supabase_realtime ADD TABLE queue_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE queue_events;

-- ==============================================================================
-- INITIAL SEED DATA
-- Matches the Stitch designs for instant out-of-the-box demonstration
-- ==============================================================================

-- Departments
INSERT INTO departments (id, name, code, wing, description, floor) VALUES
('d0000001-0000-0000-0000-000000000001', 'General Medicine', 'GM', 'Wing A', 'General adult outpatient clinical consultations', '1st Floor'),
('d0000001-0000-0000-0000-000000000002', 'Cardiology', 'CARD', 'Wing A', 'Cardiac diagnostics, ECG telemetry & intervention', '1st Floor'),
('d0000001-0000-0000-0000-000000000003', 'Pediatrics', 'PD', 'Wing B', 'Infant, child & adolescent primary care', 'Ground Floor'),
('d0000001-0000-0000-0000-000000000004', 'Dermatology', 'DM', 'Wing B', 'Dermatological and skin outpatient clinic', '2nd Floor'),
('d0000001-0000-0000-0000-000000000005', 'Orthopedics', 'OR', 'Wing B', 'Bone and joint clinic, cast room & trauma rehab', 'Ground Floor'),
('d0000001-0000-0000-0000-000000000006', 'ENT', 'ENT', 'Wing C', 'Ear, nose and throat specialized consultation', '3rd Floor')
ON CONFLICT (code) DO NOTHING;

-- Doctors & Profiles
INSERT INTO profiles (id, email, full_name, role, mrn, uid_code, phone) VALUES
('u0000001-0000-0000-0000-000000000001', 'sarah.jenkins@opdqueue.hospital', 'Dr. Sarah Jenkins, MD', 'doctor', 'DR-CARD-104', 'DRJENK01', '+1 (555) 019-2831'),
('u0000001-0000-0000-0000-000000000002', 'johnathan.doe@gmail.com', 'Johnathan Doe', 'patient', 'MRN-90248', 'JOHDOES32101990', '+1 (555) 234-8901'),
('u0000001-0000-0000-0000-000000000003', 'admin@opdqueue.hospital', 'Chief Med. Admin', 'admin', 'ADM-001', 'ADMCHIEF01', '+1 (555) 000-9999')
ON CONFLICT (email) DO NOTHING;

-- Cabins
INSERT INTO cabins (id, cabin_number, department_id, current_doctor_id, status, serving_token_number, corridor) VALUES
('c0000001-0000-0000-0000-000000000001', 'Cabin 101', 'd0000001-0000-0000-0000-000000000001', NULL, 'active', '#GM-38', 'Corridor A'),
('c0000001-0000-0000-0000-000000000002', 'Cabin 102', 'd0000001-0000-0000-0000-000000000003', NULL, 'active', '#PD-41', 'Corridor B'),
('c0000001-0000-0000-0000-000000000003', 'Cabin 103', 'd0000001-0000-0000-0000-000000000004', NULL, 'active', '#DM-19', 'Corridor B'),
('c0000001-0000-0000-0000-000000000004', 'Cabin 104', 'd0000001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000001', 'active', '#CARD-042', 'Corridor B'),
('c0000001-0000-0000-0000-000000000005', 'Cabin 105', 'd0000001-0000-0000-0000-000000000005', NULL, 'active', '#OR-22', 'Corridor B'),
('c0000001-0000-0000-0000-000000000006', 'Cabin 106', 'd0000001-0000-0000-0000-000000000006', NULL, 'on_break', '#ENT-14', 'Corridor C')
ON CONFLICT (cabin_number) DO NOTHING;

-- Initial Queue Tokens
INSERT INTO queue_tokens (id, token_display, sequence_number, patient_id, department_id, cabin_id, doctor_id, priority, status, estimated_wait_mins, chief_complaint) VALUES
('t0000001-0000-0000-0000-000000000001', '#12', 12, 'u0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000004', 'u0000001-0000-0000-0000-000000000001', 'priority', 'waiting', 12, 'Chest Discomfort, Sudden Mild Palpitations post-caffeine')
ON CONFLICT DO NOTHING;
