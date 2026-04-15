"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
  ScatterChart, Scatter, ErrorBar,
} from "recharts";
import { getSupabaseClient } from "@/lib/supabase/client";
import { SectionHeader, StatCard, LoadingSpinner, Bar } from "../ui";

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: "bg-emerald-950/30", border: "border-emerald-500", text: "text-emerald-400" },
  B: { bg: "bg-blue-950/30", border: "border-blue-500", text: "text-blue-400" },
  C: { bg: "bg-yellow-950/30", border: "border-yellow-500", text: "text-yellow-400" },
  D: { bg: "bg-red-950/30", border: "border-red-500", text: "text-red-400" },
};

const HISTOGRAM_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6",
];

const PIE_COLORS = ["#22c55e", "#ef4444"];

export function Stage6Validation({ runId }: { runId: string }) {
  const [report, setReport] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    Promise.all([
      supabase.from("validation_reports").select("*").eq("run_id", runId).limit(1).single(),
      supabase.from("respondent_scores").select("*").eq("run_id", runId),
    ]).then(([rRes, sRes]) => {
      setReport(rRes.data);
      setScores(sRes.data || []);
      setLoading(false);
    });
  }, [runId]);

  if (loading) return <LoadingSpinner />;
  if (!report) return <p className="text-gray-500 text-sm">No validation report found.</p>;

  const gradeStyle = GRADE_COLORS[report.grade?.[0]] || GRADE_COLORS.D;

  // ── Quality Score Histogram ──
  const buckets: Record<string, number> = {};
  for (let i = 0; i < 100; i += 10) {
    buckets[`${i}-${i + 9}`] = 0;
  }
  scores.forEach(s => {
    const q = Math.min(s.quality_score, 99);
    const key = `${Math.floor(q / 10) * 10}-${Math.floor(q / 10) * 10 + 9}`;
    if (buckets[key] !== undefined) buckets[key]++;
  });
  const histogramData = Object.entries(buckets).map(([range, count], i) => ({
    range, count, fill: HISTOGRAM_COLORS[i],
  }));

  // ── Per-Model Quality ──
  const modelScores: Record<string, number[]> = {};
  scores.forEach(s => {
    const m = s.model?.split("/").pop() || s.model || "Unknown";
    if (!modelScores[m]) modelScores[m] = [];
    modelScores[m].push(s.quality_score);
  });
  const modelMeanData = Object.entries(modelScores).map(([model, vals]) => ({
    model,
    mean: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    min: Math.min(...vals),
    max: Math.max(...vals),
  }));

  // ── Pass/Fail Pie ──
  const passCount = report.total_checks - report.issues_found;
  const pieData = [
    { name: "Passed", value: passCount },
    { name: "Failed", value: report.issues_found },
  ];

  // ── Confidence Intervals (forest plot data) ──
  const ciItems = report.confidence_intervals || {};
  const ciData: { metric: string; mean: number; lower: number; upper: number }[] = [];
  if (Array.isArray(ciItems)) {
    ciItems.forEach((item: any) => {
      ciData.push({
        metric: item.metric || item.variable || "?",
        mean: item.point ?? item.estimate ?? item.mean ?? 0,
        lower: item.lower ?? item.ci_lower ?? item.low ?? 0,
        upper: item.upper ?? item.ci_upper ?? item.high ?? 0,
      });
    });
  } else if (typeof ciItems === "object") {
    Object.entries(ciItems).forEach(([key, val]: [string, any]) => {
      ciData.push({
        metric: key.replace(/_/g, " "),
        mean: val?.point ?? val?.estimate ?? val?.mean ?? 0,
        lower: val?.lower ?? val?.ci_lower ?? val?.low ?? 0,
        upper: val?.upper ?? val?.ci_upper ?? val?.high ?? 0,
      });
    });
  }

  // Transform CI data for scatter + error bar
  const forestData = ciData.map((d, i) => ({
    ...d,
    y: i,
    errorLow: d.mean - d.lower,
    errorHigh: d.upper - d.mean,
  }));

  // ── Attention Check ──
  const attentionPass = scores.filter(s => s.attention_pass).length;
  const attentionTotal = scores.length || 1;

  // ── Bias Detection ──
  const biasItems = report.bias_detection || {};
  const biasEntries: [string, any][] = Array.isArray(biasItems)
    ? biasItems.map((b: any, i: number) => [b.test_name || b.test || b.name || `Check ${i + 1}`, b])
    : Object.entries(biasItems);

  return (
    <div className="space-y-6">
      {/* ── Grade Hero ── */}
      <div className="flex items-center gap-6">
        <div className={`w-28 h-28 rounded-xl border-2 ${gradeStyle.border} flex items-center justify-center ${gradeStyle.bg}`}>
          <span className={`text-6xl font-black ${gradeStyle.text}`}>{report.grade}</span>
        </div>
        <div className="flex-1">
          <div className="text-xl font-semibold text-white">Data Quality Grade</div>
          <div className="text-sm text-gray-400 mt-1">
            {report.issues_found} issue{report.issues_found !== 1 ? "s" : ""} found across {report.total_checks} checks
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="h-3 w-48 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${(passCount / report.total_checks) * 100}%` }} />
            </div>
            <span className="text-sm text-gray-400 font-mono">
              {Math.round((passCount / report.total_checks) * 100)}% pass rate
            </span>
          </div>
        </div>
      </div>

      {/* ── Charts Row 1: Histogram + Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionHeader>Quality Score Distribution</SectionHeader>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={histogramData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="range" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  labelStyle={{ color: "#e5e7eb" }}
                />
                <RBar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histogramData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <SectionHeader>Check Results</SectionHeader>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Charts Row 2: Per-Model Quality ── */}
      <div>
        <SectionHeader>Quality Score by Model</SectionHeader>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={modelMeanData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="model" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
              <RBar dataKey="mean" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Mean Score" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            {modelMeanData.map(m => (
              <div key={m.model} className="text-center">
                <span className="text-xs text-gray-500">{m.model}</span>
                <div className="text-sm text-gray-300 font-mono">{m.mean}/100</div>
                <div className="text-xs text-gray-500">range: {m.min}–{m.max}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Confidence Interval Forest Plot ── */}
      {forestData.length > 0 && (
        <div>
          <SectionHeader>Confidence Intervals (95%)</SectionHeader>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="space-y-3">
              {ciData.map((d, i) => {
                const range = 5; // Likert 1-5
                const leftPct = ((d.lower - 1) / (range - 1)) * 100;
                const widthPct = ((d.upper - d.lower) / (range - 1)) * 100;
                const dotPct = ((d.mean - 1) / (range - 1)) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-36 text-xs text-gray-400 text-right truncate">{d.metric}</span>
                    <div className="flex-1 relative h-6 bg-gray-800 rounded">
                      {/* Midpoint line */}
                      <div className="absolute top-0 bottom-0 w-px bg-gray-600" style={{ left: "50%" }} />
                      {/* CI bar */}
                      <div className="absolute top-1.5 h-3 bg-blue-500/40 rounded"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
                      {/* Mean dot */}
                      <div className="absolute top-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-blue-300"
                        style={{ left: `calc(${dotPct}% - 8px)` }} />
                    </div>
                    <span className="w-28 text-xs text-gray-300 font-mono">
                      {d.mean.toFixed(2)} [{d.lower.toFixed(2)}, {d.upper.toFixed(2)}]
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 mt-1">
                <span className="w-36" />
                <div className="flex-1 flex justify-between text-xs text-gray-600">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                </div>
                <span className="w-28" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Attention Check ── */}
      <div>
        <SectionHeader>Attention Check (Q30)</SectionHeader>
        <div className="flex items-center gap-4">
          <div className="h-8 flex-1 flex rounded-lg overflow-hidden border border-gray-700">
            <div className="bg-emerald-600 flex items-center justify-center text-xs font-medium transition-all"
              style={{ width: `${(attentionPass / attentionTotal) * 100}%` }}>
              {attentionPass} pass
            </div>
            {attentionTotal - attentionPass > 0 && (
              <div className="bg-red-800 flex items-center justify-center text-xs font-medium transition-all"
                style={{ width: `${((attentionTotal - attentionPass) / attentionTotal) * 100}%` }}>
                {attentionTotal - attentionPass} fail
              </div>
            )}
          </div>
          <span className="text-lg text-gray-300 font-mono font-bold">
            {Math.round((attentionPass / attentionTotal) * 100)}%
          </span>
        </div>
      </div>

      {/* ── Bias Detection ── */}
      {biasEntries.length > 0 && (
        <div>
          <SectionHeader>Bias Detection</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {biasEntries.slice(0, 9).map(([key, val], i) => {
              const passed = typeof val === "object"
                ? (val.passed != null ? val.passed : val.significant != null ? !val.significant : val.result === "pass")
                : !!val;
              return (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                  passed
                    ? "border-emerald-800/50 bg-emerald-950/20"
                    : "border-red-800/50 bg-red-950/20"
                }`}>
                  <span className={`text-lg ${passed ? "text-emerald-400" : "text-red-400"}`}>
                    {passed ? "\u2713" : "\u2717"}
                  </span>
                  <span className="text-sm text-gray-300">
                    {typeof key === "string" ? key.replace(/_/g, " ") : String(key)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recommendation ── */}
      <div>
        <SectionHeader>Recommendation</SectionHeader>
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-5 border-l-4 border-l-blue-500">
          <p className="text-gray-300 text-sm leading-relaxed">{report.recommendation}</p>
        </div>
      </div>
    </div>
  );
}
