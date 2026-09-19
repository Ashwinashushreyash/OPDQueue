"use client";

import React, { useState } from "react";
import Header from "@/components/Header";

export default function PatientPage() {
  const [assignedToken, setAssignedToken] = useState("#12");
  const [currentExamToken, setCurrentExamToken] = useState("#09");
  const [patientsAhead, setPatientsAhead] = useState(2);
  const [expectedTime, setExpectedTime] = useState("10:15 AM");
  const [chimeEnabled, setChimeEnabled] = useState(true);
  const [smsSent, setSmsSent] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [selectedDay, setSelectedDay] = useState("Tue 15");
  const [selectedWindow, setSelectedWindow] = useState("Morning B");

  const handleSendSms = () => {
    setSmsSent(true);
    setTimeout(() => setSmsSent(false), 4000);
  };

  const handleConfirmBooking = () => {
    setBookingConfirmed(true);
    setTimeout(() => setBookingConfirmed(false), 5000);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Universal Clinical Header */}
      <Header activeToken={assignedToken} estimatedWait="18 min" role="patient" />

      {/* Main Container */}
      <main className="w-full pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
        {/* SMS Notification Banner */}
        {smsSent && (
          <div className="bg-primary text-on-primary p-3 rounded-xl shadow-md flex items-center justify-between text-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">sms</span>
              <span>SMS Alert link sent to +1 (555) 234-8901. We will alert you when Token #10 enters!</span>
            </div>
            <button onClick={() => setSmsSent(false)} className="text-white/80 hover:text-white">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Booking Confirmation Alert */}
        {bookingConfirmed && (
          <div className="bg-secondary-container text-on-secondary-container p-3 rounded-xl shadow-md flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
              <span className="font-semibold">
                Follow-up appointment reserved for {selectedDay} ({selectedWindow}) with Dr. Sarah Jenkins!
              </span>
            </div>
            <button onClick={() => setBookingConfirmed(false)} className="text-on-secondary-container/70">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Patient Hero Bar & Welcome Banner */}
        <section className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm p-6 lg:p-8 border border-surface-container-high/40">
          <div className="absolute -right-20 -top-24 w-80 h-80 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-16 w-64 h-64 rounded-full bg-tertiary/5 blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col gap-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-xs font-semibold">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  UID: JOHDOES32101990 • Verified
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-xs">
                  <span className="material-symbols-outlined text-[14px]">apartment</span>
                  Tower 3, 1st Floor
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  Queue Live
                </span>
              </div>
              <h1 className="font-headline-lg text-2xl lg:text-3xl font-bold text-on-surface tracking-tight mt-1">
                Welcome back, <span className="text-primary">Johnathan Doe</span>
              </h1>
              <p className="font-body-md text-sm text-on-surface-variant">
                You have an active clinical appointment scheduled for this morning. Your journey is being tracked in real time to ensure minimal waiting lounge fatigue.
              </p>
            </div>

            {/* Quick Status Active Appointment Card */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low border border-surface-container-high/50 lg:max-w-md w-full shadow-xs">
              <div className="w-12 h-12 rounded-lg bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[26px]">medical_services</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-label-sm text-xs text-primary uppercase font-bold tracking-wider">
                    Active Visit Today
                  </span>
                  <span className="w-1 h-1 rounded-full bg-outline-variant" />
                  <span className="font-label-sm text-xs text-secondary">Cardiology</span>
                </div>
                <span className="font-title-md text-base font-semibold text-on-surface truncate">
                  Dr. Sarah Jenkins, MD
                </span>
                <span className="font-body-sm text-xs text-on-surface-variant truncate">
                  Cabin 104 • Corridor B • Priority: Tier 1
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Central Live Queue & Journey Tracker Grid */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Main Interactive Telemetry Board (8 cols) */}
          <div className="xl:col-span-8 flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm p-6 lg:p-8 border border-surface-container-high/40 flex flex-col justify-between gap-6">
              {/* Top Status Indicators */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-xl bg-surface-container-high text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">radar</span>
                  </span>
                  <div>
                    <h2 className="font-headline-sm text-lg font-bold text-on-surface leading-tight">
                      Cardiology OPD Stream
                    </h2>
                    <span className="font-body-sm text-xs text-on-surface-variant">
                      Real-time synchronized clinic dispatch
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full font-label-sm text-xs">
                    <span className="material-symbols-outlined text-[14px]">history</span>
                    Updated real-time
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded-full font-label-sm text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Lounge Audio Synced
                  </span>
                </div>
              </div>

              {/* Live Telemetric Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Your Assigned Token */}
                <div className="bg-surface-container-low p-5 rounded-xl border border-primary/20 flex flex-col justify-between relative overflow-hidden">
                  <span className="font-label-sm text-xs text-on-surface-variant uppercase font-semibold">
                    Your Assigned Token
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-token-display text-4xl font-bold text-primary">
                      {assignedToken}
                    </span>
                    <span className="font-label-sm text-xs text-secondary font-medium">General OPD</span>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-primary font-semibold">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Verified & Present</span>
                  </div>
                </div>

                {/* 2. Now in Cabin */}
                <div className="bg-surface-container-low p-5 rounded-xl border border-surface-container-high/60 flex flex-col justify-between">
                  <span className="font-label-sm text-xs text-on-surface-variant uppercase font-semibold">
                    Now in Cabin 104
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-token-display text-4xl font-bold text-on-surface">
                      {currentExamToken}
                    </span>
                    <span className="bg-tertiary-fixed text-on-tertiary-fixed font-bold text-xs px-2 py-0.5 rounded-full uppercase">
                      In Exam
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-on-surface-variant font-medium">
                    <span className="material-symbols-outlined text-secondary text-[16px]">groups</span>
                    <span>{patientsAhead} Patients ahead of you</span>
                  </div>
                </div>

                {/* 3. Expected Consultation */}
                <div className="bg-surface-container-low p-5 rounded-xl border border-surface-container-high/60 flex flex-col justify-between">
                  <span className="font-label-sm text-xs text-on-surface-variant uppercase font-semibold">
                    Expected Consultation
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-token-display text-4xl font-bold text-on-surface">
                      {expectedTime}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-on-surface-variant font-medium">
                    <span className="material-symbols-outlined text-secondary text-[16px]">hourglass_top</span>
                    <span>Approx. 18 mins wait</span>
                  </div>
                </div>
              </div>

              {/* Waiting Lounge Reassurance Strip */}
              <div className="bg-surface-container-low/70 border border-secondary/20 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary-container text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">local_cafe</span>
                  </div>
                  <div>
                    <h4 className="font-title-sm text-sm font-semibold text-on-surface">
                      Safe to relax outside the waiting corridor
                    </h4>
                    <p className="font-body-sm text-xs text-on-surface-variant">
                      Return recommended by 10:05 AM. We will trigger an automated SMS buzz when Token #10 enters.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSendSms}
                  className="bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap shadow-xs"
                >
                  Send SMS Alert Link
                </button>
              </div>

              {/* Patient Journey Pipeline */}
              <div className="flex flex-col gap-3 pt-2">
                <span className="font-label-sm text-xs text-secondary uppercase font-semibold tracking-wider">
                  Patient Journey Pipeline
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Step 1: Registration */}
                  <div className="flex flex-col p-3 rounded-xl bg-surface-container-low border border-primary/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-primary">1. Registration</span>
                      <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    </div>
                    <span className="text-xs text-on-surface-variant">09:45 AM • Desk 4</span>
                    <span className="text-xs font-semibold text-primary mt-1">Completed</span>
                  </div>

                  {/* Step 2: Vitals Triage */}
                  <div className="flex flex-col p-3 rounded-xl bg-surface-container-low border border-primary/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-primary">2. Vitals Triage</span>
                      <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    </div>
                    <span className="text-xs text-on-surface-variant">10:00 AM • Station B</span>
                    <span className="text-xs font-semibold text-primary mt-1">BP 124/82 • 74 bpm</span>
                  </div>

                  {/* Step 3: Doctor Consult */}
                  <div className="flex flex-col p-3 rounded-xl bg-secondary-container/40 border border-primary">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-primary">3. Doctor Consult</span>
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    </div>
                    <span className="text-xs text-on-surface-variant">Dr. Jenkins • Cabin 104</span>
                    <span className="text-xs font-bold text-primary mt-1">UP NEXT (#12)</span>
                  </div>

                  {/* Step 4: Pharmacy & Labs */}
                  <div className="flex flex-col p-3 rounded-xl bg-surface-container-low border border-surface-container-high/60 opacity-60">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-on-surface">4. Pharmacy & Labs</span>
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">pending</span>
                    </div>
                    <span className="text-xs text-on-surface-variant">Ground Floor • Bay C</span>
                    <span className="text-xs text-on-surface-variant mt-1">Pending Consult</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Clinical Sidebar (4 cols) */}
          <div className="xl:col-span-4 flex flex-col gap-6">
            {/* Attending Physician Card */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-xs text-secondary uppercase font-semibold">
                  Attending Cardiologist
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold bg-primary-fixed/40 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  In Session
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl border border-primary/20 shadow-xs">
                  SJ
                </div>
                <div className="flex flex-col">
                  <h3 className="font-headline-sm text-base font-bold text-on-surface">
                    Dr. Sarah Jenkins, MD
                  </h3>
                  <span className="text-xs text-secondary font-medium">
                    Senior Interventional Cardiologist
                  </span>
                  <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">star</span>
                    <span>4.9 / 5.0 (340 reviews)</span>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-low p-3.5 rounded-xl flex flex-col gap-1 text-xs text-on-surface-variant border border-surface-container-high/40">
                <div className="flex justify-between">
                  <span>Specialty Focus:</span>
                  <span className="font-medium text-on-surface">Hypertension & Arrhythmia</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg. Visit Duration:</span>
                  <span className="font-medium text-on-surface">12–14 mins</span>
                </div>
                <div className="flex justify-between">
                  <span>Cabin Assistant:</span>
                  <span className="font-medium text-on-surface">Nurse Raymond (Ext 210)</span>
                </div>
              </div>

              {/* Chime toggle control */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-surface-container-high/40">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">volume_up</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-on-surface">Queue Chime Audio</span>
                    <span className="text-[11px] text-on-surface-variant">Alerts 1 min before turn</span>
                  </div>
                </div>
                <button
                  onClick={() => setChimeEnabled(!chimeEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                    chimeEnabled ? "bg-primary" : "bg-surface-container-highest"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      chimeEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Hospital Indoor Navigation */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-label-sm text-xs text-secondary uppercase font-semibold">
                    Active Destination
                  </span>
                  <h4 className="font-title-md text-base font-bold text-on-surface">
                    Cabin 104 • Cardiology
                  </h4>
                </div>
                <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                  A
                </div>
              </div>

              <div className="bg-surface-container-low p-3 rounded-xl text-xs text-on-surface-variant flex flex-col gap-2 border border-surface-container-high/40">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">stairs</span>
                  <span>Take Central Elevator C or Escalator to <strong>Floor 1</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-secondary text-[18px]">turn_right</span>
                  <span>Turn right past Reception into <strong>Corridor B</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-tertiary text-[18px]">door_front</span>
                  <span>Cabin 104 is the second door on your left</span>
                </div>
              </div>

              <button className="w-full bg-surface-container-high hover:bg-surface-container text-on-surface py-2.5 rounded-xl font-title-sm text-xs font-semibold flex items-center justify-center gap-2 transition-colors">
                <span className="material-symbols-outlined text-[18px] text-primary">explore</span>
                <span>Open Turn-by-Turn Indoor Compass</span>
              </button>
            </div>
          </div>
        </section>

        {/* Bottom Section: Prescriptions & Follow-up Booking */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Medical Records & Prescriptions */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">prescriptions</span>
                Medical Records & Prescriptions
              </h3>
              <span className="text-xs text-primary font-semibold cursor-pointer hover:underline">
                View Archive &rarr;
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {/* Item 1 */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">medication</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-title-sm text-sm font-semibold text-on-surface">
                        Atorvastatin 20mg
                      </span>
                      <span className="bg-secondary-container text-on-secondary-container text-[11px] font-bold px-2 py-0.5 rounded-full">
                        Daily Bedtime
                      </span>
                    </div>
                    <span className="text-xs text-on-surface-variant">
                      Cardiology Maintenance • Prescribed by Dr. Sarah Jenkins
                    </span>
                  </div>
                </div>
                <button className="text-xs bg-surface-container-highest hover:bg-surface-container text-on-surface font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  PDF RX
                </button>
              </div>

              {/* Item 2 */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-tertiary/10 text-tertiary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">pill</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-title-sm text-sm font-semibold text-on-surface">
                        Ramipril 5mg (Vasotec)
                      </span>
                      <span className="bg-surface-container text-on-surface-variant text-[11px] font-bold px-2 py-0.5 rounded-full">
                        Morning 08:00 AM
                      </span>
                    </div>
                    <span className="text-xs text-on-surface-variant">
                      Hypertension protocol • Issued Sept 14, 2024
                    </span>
                  </div>
                </div>
                <button className="text-xs bg-surface-container-highest hover:bg-surface-container text-on-surface font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  PDF RX
                </button>
              </div>
            </div>
          </div>

          {/* Book Next Follow-up Window */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">calendar_month</span>
                Book Next Follow-up Window
              </h3>
              <span className="text-xs text-secondary font-medium">Reserve consultation slot</span>
            </div>

            {/* Day Selector */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { day: "Mon", date: "14", status: "Avail" },
                { day: "Tue", date: "15", status: "Selected" },
                { day: "Wed", date: "16", status: "Avail" },
                { day: "Thu", date: "17", status: "Full" },
              ].map((item) => {
                const isSelected = selectedDay === `${item.day} ${item.date}`;
                const isFull = item.status === "Full";
                return (
                  <button
                    key={item.date}
                    disabled={isFull}
                    onClick={() => setSelectedDay(`${item.day} ${item.date}`)}
                    className={`p-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? "bg-primary text-on-primary font-bold shadow-sm"
                        : isFull
                        ? "bg-surface-container-low text-outline-variant opacity-50 cursor-not-allowed"
                        : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    <span className="text-[11px] uppercase">{item.day}</span>
                    <span className="text-base font-bold">{item.date}</span>
                    <span className="text-[10px]">{item.status}</span>
                  </button>
                );
              })}
            </div>

            {/* Available Shift Windows */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "Morning A", time: "08:30 – 10:30 AM", extra: "4 Tokens left" },
                { name: "Morning B", time: "10:30 – 12:30 PM", extra: "Recommended" },
                { name: "Evening A", time: "03:00 – 05:00 PM", extra: "6 Tokens left" },
                { name: "Evening B", time: "05:00 – 07:00 PM", extra: "2 Tokens left" },
              ].map((slot) => {
                const isSelected = selectedWindow === slot.name;
                return (
                  <button
                    key={slot.name}
                    onClick={() => setSelectedWindow(slot.name)}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      isSelected
                        ? "border-primary bg-secondary-container/30 text-on-surface"
                        : "border-surface-container-high bg-surface-container-low hover:bg-surface-container"
                    }`}
                  >
                    <div className="font-title-sm text-xs font-semibold text-primary">{slot.name}</div>
                    <div className="text-xs text-on-surface mt-0.5">{slot.time}</div>
                    <div className="text-[11px] text-secondary font-medium mt-1">{slot.extra}</div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleConfirmBooking}
              className="w-full bg-primary hover:bg-primary-container text-on-primary font-title-sm text-sm font-semibold py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">event_available</span>
              <span>Confirm Provisional Reservation</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
