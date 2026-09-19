"use client";

import React, { useState } from "react";
import Link from "next/link";
import SplashScreen from "@/components/SplashScreen";

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      <main className="min-h-screen bg-background flex flex-col justify-between p-6 lg:p-12">
        {/* Top Navbar */}
        <header className="max-w-6xl mx-auto w-full flex items-center justify-between pb-8 border-b border-surface-container-high/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center p-2 shadow-sm">
              <img src="/logo.png" alt="OPDQueue Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-bold text-primary leading-tight">
                OPDQueue
              </span>
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                Clinical Queue Intelligence
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSplash(true)}
              className="text-xs bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant font-medium px-3 py-1.5 rounded-lg border border-surface-container-high/50 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">play_circle</span>
              Replay Splash
            </button>
          </div>
        </header>

        {/* Hero & Role Selection */}
        <div className="max-w-5xl mx-auto w-full py-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            OPD Telemetry & Real-Time Hospital Dispatch
          </div>

          <h1 className="font-headline-xl text-3xl sm:text-5xl font-bold text-on-surface tracking-tight max-w-3xl leading-tight">
            Restorative Clinical Queue Intelligence for Modern Outpatient Care
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mt-4">
            A synchronized clinical ecosystem connecting patients, attending physicians, and command center operations in real time.
          </p>

          {/* Role Access Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-12 text-left">
            {/* 1. Patient Portal */}
            <Link
              href="/patient"
              className="group relative bg-surface-container-lowest hover:bg-surface-container-low p-6 rounded-2xl border border-surface-container-high/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex flex-col gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">sensor_occupied</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                  Patient Care Portal
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Track live token progression (#12), real-time ETA, turn-by-turn indoor directions to Cabin 104, and follow-up slots.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-surface-container-high/40 flex items-center justify-between text-primary font-semibold text-sm">
                <span>Enter Live Queue</span>
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </Link>

            {/* 2. Doctor Workspace */}
            <Link
              href="/doctor"
              className="group relative bg-surface-container-lowest hover:bg-surface-container-low p-6 rounded-2xl border border-surface-container-high/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex flex-col gap-3">
                <div className="w-12 h-12 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">stethoscope</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface group-hover:text-tertiary transition-colors">
                  Doctor EHR Station
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  One-click triage dispatch (Call Next Token #13, Hold, Emergency), patient vitals inspection, and Smart Rx prescription builder.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-surface-container-high/40 flex items-center justify-between text-tertiary font-semibold text-sm">
                <span>Open Workstation</span>
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </Link>

            {/* 3. Admin Command Center */}
            <Link
              href="/admin"
              className="group relative bg-surface-container-lowest hover:bg-surface-container-low p-6 rounded-2xl border border-surface-container-high/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex flex-col gap-3">
                <div className="w-12 h-12 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">monitor_heart</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                  Admin Command Grid
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Fleet telemetry for Cabins 101–106, dynamic queue rebalancing, surge projections, and hospital-wide emergency override.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-surface-container-high/40 flex items-center justify-between text-secondary font-semibold text-sm">
                <span>View Operations</span>
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="max-w-6xl mx-auto w-full pt-8 border-t border-surface-container-high/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
          <div>&copy; 2026 OPDQueue Smart Healthcare Operations. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <span>HIPAA Compliant</span>
            <span>HL7 / FHIR Gateway Active</span>
            <span>24/7 Triage Helpdesk</span>
          </div>
        </footer>
      </main>
    </>
  );
}
