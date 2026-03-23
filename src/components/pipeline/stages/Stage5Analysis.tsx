"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import { getSupabaseClient } from "@/lib/supabase/client";
import { SectionHeader, StatCard, LoadingSpinner } from "../ui";

const MODEL_COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];
const KEY_VARS = ["Q1", "Q2", "Q7", "Q0b", "Q5_cost", "Q5_hoa", "Q5_permit"];
const KEY_LABELS: Record<string, string> = {
  Q1: "Purchase Int.", Q2: "Purchase Lik.", Q7: "Permit Effect",
  Q0b: "Category Int.", Q5_cost: "Cost Barrier", Q5_hoa: "HOA Barrier", Q5_permit: "Permit Barrier",
};

function cellColor(val: number): string {
  if (val >= 4) return "#166534";
  if (val >= 3.5) return "#16a34a";
  if (val >= 3) return "#eab308";
  if (val >= 2.5) return "#f97316";
  return "#ef4444";
}

export function Stage5Analysis({ runId }: { runId: string }) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.from("analysis_results").select("*").eq("run_id", runId)
      .then(({ data }) => {
        setResults(data || []);
        setLoading(false);
      });
  }, [runId]);

  const byType = useMemo(() => {
    const map: Record<string, any[]> = {};
    results.forEach(r => {
      map[r.analysis_type] = map[r.analysis_type] || [];
      map[r.analysis_type].push(r);
    });
    return map;
  }, [results]);

  // Extract cross-tab data
  const crossTab = useMemo(() => {
    const items = byType["cross_tabulation"] || [];
    if (items.length === 0) return null;
    return items[0].results;
  }, [byType]);

  // Model comparison bars
  const modelBarData = useMemo(() => {
    if (!crossTab?.model_means) return [];
    return KEY_VARS.map(v => {
      const row: Record<string, string | number> = { variable: KEY_LABELS[v] || v };
      Object.entries(crossTab.model_means as Record<string, Record<string, number>>).forEach(([model, vals]) => {
        row[model] = vals[v] ?? 0;
      });
      return row;
    });
  }, [crossTab]);

  const modelNames = useMemo(() => {
    if (!crossTab?.model_means) return [];
    return Object.keys(crossTab.model_means);
  }, [crossTab]);

  // Attention check pie
  const attentionRate = crossTab?.attention_check_pass_rate ?? null;
  const attentionPie = attentionRate != null ? [
    { name: "Pass", value: Math.round(attentionRate * 100) },
    { name: "Fail", value: 100 - Math.round(attentionRate * 100) },
  ] : null;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Analysis Types" value={Object.keys(byType).length} />
        <StatCard label="Total Results" value={results.length} />
        <StatCard label="Respondents" value={crossTab?.total_respondents ?? "—"} />
        <StatCard label="Attention Pass" value={attentionRate != null ? `${Math.round(attentionRate * 100)}%` : "—"} />
      </div>

      {/* Model Comparison Bar Chart */}
      {modelBarData.length > 0 && (
        <div>
          <SectionHeader>Key Variables by Model</SectionHeader>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modelBarData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="variable" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis domain={[0, 5]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {modelNames.map((m, i) => (
                  <RBar key={m} dataKey={m} fill={MODEL_COLORS[i % MODEL_COLORS.length]}
                    radius={[3, 3, 0, 0]} name={m.split("/").pop() || m} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Segment Cross-Tab Heatmap */}
      {crossTab?.segment_means && (
        <div>
          <SectionHeader>Segment Comparison (Key Variables)</SectionHeader>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Variable</th>
                  {Object.keys(crossTab.segment_means).map((seg: string) => (
                    <th key={seg} className="text-center py-2 px-2 text-gray-400 font-medium">
                      {seg.length > 16 ? seg.slice(0, 14) + "…" : seg}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {KEY_VARS.map(v => (
                  <tr key={v} className="border-b border-gray-800/50">
                    <td className="py-2 px-3 text-gray-300 font-mono text-xs">{KEY_LABELS[v] || v}</td>
                    {Object.entries(crossTab.segment_means as Record<string, Record<string, number>>).map(([seg, vals]) => {
                      const val = vals[v] ?? 0;
                      return (
                        <td key={seg} className="py-2 px-2 text-center">
                          <span className="inline-block w-12 h-7 rounded text-xs font-mono font-bold leading-7"
                            style={{ backgroundColor: cellColor(val) + "33", color: cellColor(val) }}>
                            {val.toFixed(2)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Model Means Cards */}
      {crossTab?.model_means && (
        <div>
          <SectionHeader>Model Summary Cards</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(crossTab.model_means as Record<string, Record<string, number>>).map(([model, vals], i) => (
              <div key={model} className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                  <span className="text-sm font-semibold text-white">{model}</span>
                </div>
                <div className="space-y-2">
                  {KEY_VARS.map(v => (
                    <div key={v} className="flex justify-between text-xs">
                      <span className="text-gray-400">{KEY_LABELS[v] || v}</span>
                      <span className="font-mono font-bold" style={{ color: cellColor(vals[v] ?? 0) }}>
                        {(vals[v] ?? 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attention Check Donut */}
      {attentionPie && (
        <div>
          <SectionHeader>Attention Check (Q30)</SectionHeader>
          <div className="flex items-center gap-6">
            <div className="w-40">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={attentionPie} cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                    paddingAngle={4} dataKey="value">
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{attentionPie[0].value}%</div>
              <div className="text-sm text-gray-400">of respondents passed the attention check</div>
            </div>
          </div>
        </div>
      )}

      {/* Other analysis types (generic) */}
      {Object.entries(byType)
        .filter(([type]) => type !== "cross_tabulation")
        .map(([type, items]) => (
          <div key={type}>
            <SectionHeader>{type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SectionHeader>
            {items.map((item, i) => (
              <div key={i} className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 mb-3">
                {item.group_by && <p className="text-xs text-gray-500 mb-2">Grouped by: {item.group_by}</p>}
                <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(item.results, null, 2).slice(0, 600)}
                </pre>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
