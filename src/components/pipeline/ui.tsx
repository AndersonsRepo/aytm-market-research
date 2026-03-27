import React from "react";

// ─── Shared UI primitives ─────────────────────────────────────────────────

export function Bar({ label, value, max, color = "bg-blue-500", suffix = "" }: {
  label: string; value: number; max: number; color?: string; suffix?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm group">
      <span className="w-40 text-gray-400 truncate group-hover:text-gray-200 transition-colors">{label}</span>
      <div className="flex-1 h-6 bg-gray-800/80 rounded-lg overflow-hidden relative">
        <div
          className={`h-full ${color} rounded-lg animate-bar-grow relative overflow-hidden`}
          style={{ width: `${pct}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      </div>
      <span className="w-16 text-right text-gray-300 font-mono text-xs tabular-nums">{value}{suffix}</span>
    </div>
  );
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-8 mb-3 first:mt-0 flex items-center gap-2">
      <span className="w-6 h-px bg-gray-700" />
      {children}
    </h4>
  );
}

export function Tag({ children, color = "bg-blue-900/40 text-blue-300 border-blue-800/40" }: {
  children: React.ReactNode; color?: string;
}) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium border ${color}`}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 text-center hover:border-gray-600/60 transition-all group">
      <div className="text-2xl font-bold text-white animate-count-up group-hover:scale-105 transition-transform">{value}</div>
      <div className="text-[11px] text-gray-500 mt-1.5 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12 gap-3">
      <div className="relative w-6 h-6">
        <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full" />
        <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <span className="text-sm text-gray-500">Loading results...</span>
    </div>
  );
}
