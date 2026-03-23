import React from "react";

// ─── Shared UI primitives extracted from StageCard.tsx ──────────────────────

export function Bar({ label, value, max, color = "bg-blue-500", suffix = "" }: {
  label: string; value: number; max: number; color?: string; suffix?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-40 text-gray-400 truncate">{label}</span>
      <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
        <div className={`h-full ${color} rounded transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-gray-300 font-mono text-xs">{value}{suffix}</span>
    </div>
  );
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mt-6 mb-3 first:mt-0">{children}</h4>;
}

export function Tag({ children, color = "bg-blue-900/50 text-blue-300" }: { children: React.ReactNode; color?: string }) {
  return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>{children}</span>;
}

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8 gap-3">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-gray-400">Loading results...</span>
    </div>
  );
}
