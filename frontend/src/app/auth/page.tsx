"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"patient" | "doctor" | "admin">("patient");

  const handleSelectRole = (role: "patient" | "doctor" | "admin") => {
    setSelectedRole(role);
    if (typeof window !== "undefined") {
      localStorage.setItem("opd_active_role", role);
    }
    if (role === "patient") router.push("/patient");
    if (role === "doctor") router.push("/doctor");
    if (role === "admin") router.push("/admin");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6">
      <div className="max-w-md w-full bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-surface-container-high/60">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center p-2 mb-3">
            <img src="/logo.png" alt="OPDQueue Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
            OPDQueue Access Portal
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Choose your clinical or patient role to proceed
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Patient Option */}
          <button
            onClick={() => handleSelectRole("patient")}
            className="flex items-center justify-between p-4 rounded-xl border border-surface-container-high hover:border-primary hover:bg-surface-container-low transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">person</span>
              </div>
              <div>
                <div className="font-title-sm text-title-sm font-semibold text-on-surface">
                  Patient Portal
                </div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">
                  Johnathan Doe (MRN-90248) • Token #12
                </div>
              </div>
            </div>
            <span className="material-symbols-outlined text-primary text-[20px]">chevron_right</span>
          </button>

          {/* Doctor Option */}
          <button
            onClick={() => handleSelectRole("doctor")}
            className="flex items-center justify-between p-4 rounded-xl border border-surface-container-high hover:border-tertiary hover:bg-surface-container-low transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-tertiary/10 text-tertiary flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">stethoscope</span>
              </div>
              <div>
                <div className="font-title-sm text-title-sm font-semibold text-on-surface">
                  Attending Physician
                </div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">
                  Dr. Sarah Jenkins, MD • Cabin 104
                </div>
              </div>
            </div>
            <span className="material-symbols-outlined text-tertiary text-[20px]">chevron_right</span>
          </button>

          {/* Admin Option */}
          <button
            onClick={() => handleSelectRole("admin")}
            className="flex items-center justify-between p-4 rounded-xl border border-surface-container-high hover:border-secondary hover:bg-surface-container-low transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
              </div>
              <div>
                <div className="font-title-sm text-title-sm font-semibold text-on-surface">
                  Hospital Operations Admin
                </div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">
                  Chief Medical Administrator • Wing A–C
                </div>
              </div>
            </div>
            <span className="material-symbols-outlined text-secondary text-[20px]">chevron_right</span>
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-surface-container-high/40 text-center">
          <Link href="/" className="text-xs text-secondary hover:text-primary font-medium">
            &larr; Back to App Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
