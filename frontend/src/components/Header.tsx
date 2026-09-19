"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface HeaderProps {
  activeToken?: string;
  estimatedWait?: string;
  role?: "patient" | "doctor" | "admin";
  userName?: string;
  userIdentifier?: string;
  userInitials?: string;
}

export default function Header({
  activeToken = "#CARD-042",
  estimatedWait = "12 min",
  role = "patient",
  userName = "Johnathan Doe",
  userIdentifier = "MRN-90248",
  userInitials = "JD",
}: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 w-full z-40 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container-high/40">
      <div className="h-16 max-w-7xl mx-auto px-space-md lg:px-space-xl flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-space-lg">
          <Link href="/" className="flex items-center gap-space-sm group">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center p-1.5 shadow-sm group-hover:scale-105 transition-transform">
              <img
                src="/logo.png"
                alt="OPDQueue Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-primary font-bold leading-tight">
                OPDQueue
              </span>
              <span className="font-label-sm text-label-sm text-secondary capitalize">
                {role} Portal
              </span>
            </div>
          </Link>

          {/* Active Token Pill */}
          <div className="hidden md:flex items-center gap-space-xs bg-secondary-container text-on-secondary-container px-space-sm py-1 rounded-full font-label-md text-label-md shadow-xs">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-semibold">Active Token: {activeToken}</span>
          </div>
        </div>

        {/* Global Navigation Links across Personas */}
        <nav className="hidden lg:flex items-center gap-space-lg">
          <Link
            href="/patient"
            className={`font-title-sm text-title-sm transition-colors py-1 ${
              pathname === "/patient"
                ? "text-primary font-semibold border-b-2 border-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Live Queue
          </Link>
          <Link
            href="/patient#appointments"
            className="font-title-sm text-title-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            My Appointments
          </Link>
          <Link
            href="/patient#prescriptions"
            className="font-title-sm text-title-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Prescriptions & Records
          </Link>
          <Link
            href="/doctor"
            className={`font-title-sm text-title-sm transition-colors py-1 ${
              pathname === "/doctor"
                ? "text-primary font-semibold border-b-2 border-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Doctor Workspace
          </Link>
          <Link
            href="/admin"
            className={`font-title-sm text-title-sm transition-colors py-1 ${
              pathname === "/admin"
                ? "text-primary font-semibold border-b-2 border-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Admin Monitor
          </Link>
        </nav>

        {/* Right Side Status & Profile Strip */}
        <div className="flex items-center gap-space-md">
          {/* Estimated wait time */}
          <div className="hidden sm:flex items-center gap-space-xs bg-surface-container-low px-space-sm py-1 rounded-lg font-body-sm text-body-sm text-on-surface-variant border border-surface-container-high/30">
            <span className="material-symbols-outlined text-primary text-[18px]">
              timer
            </span>
            <span>Est. Wait: {estimatedWait}</span>
          </div>

          {/* Quick Role Switcher */}
          <Link
            href="/auth"
            className="text-xs bg-surface-container-high hover:bg-surface-container text-on-surface font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            title="Switch Role"
          >
            <span className="material-symbols-outlined text-[16px]">switch_account</span>
            <span className="hidden sm:inline">Switch</span>
          </Link>

          {/* User Profile Card */}
          <div className="flex items-center gap-space-sm pl-1">
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container font-bold flex items-center justify-center text-xs shadow-xs">
              {userInitials}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="font-title-sm text-title-sm text-on-surface leading-none font-semibold">
                {userName}
              </span>
              <span className="font-label-sm text-label-sm text-secondary leading-tight mt-0.5">
                {userIdentifier}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
