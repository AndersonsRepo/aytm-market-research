"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
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

      {/* ── Descriptive Likert (by segment and by model) ── */}
      {(byType["descriptive_likert"] || []).map((item: any, i: number) => {
        const d = item.results || {};
        const groupData = d.data as Record<string, Array<{ variable: string; label: string; n: number; mean: number; sd: number; median: number; iqr: number }>> | undefined;
        if (!groupData) return null;
        const groups = Object.entries(groupData);
        // Build bar chart data: each variable as a row, each group as a bar
        const allVars = groups.length > 0 ? groups[0][1].slice(0, 12) : [];
        const chartData = allVars.map(v => {
          const row: Record<string, string | number> = { variable: v.label || v.variable };
          groups.forEach(([gName, vars]) => {
            const match = vars.find(x => x.variable === v.variable);
            row[gName] = match?.mean ?? 0;
          });
          return row;
        });
        const groupNames = groups.map(([g]) => g);
        const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
        return (
          <div key={`desc-${i}`} className="space-y-4">
            <SectionHeader>Descriptive Statistics (by {d.by || item.group_by || "group"})</SectionHeader>
            {chartData.length > 0 && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 30)}>
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" domain={[0, 5]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <YAxis type="category" dataKey="variable" tick={{ fill: "#9ca3af", fontSize: 10 }} width={110} />
                    <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {groupNames.map((g, gi) => (
                      <RBar key={g} dataKey={g} fill={colors[gi % colors.length]} radius={[0, 3, 3, 0]}
                        name={g.length > 20 ? g.slice(0, 18) + "\u2026" : g} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Detail table */}
            {groups.map(([gName, vars]) => (
              <details key={gName} className="bg-gray-800/40 border border-gray-700 rounded-lg">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-white hover:bg-gray-800/60 rounded-lg">
                  {gName} <span className="text-gray-500 ml-1">({vars.length} variables)</span>
                </summary>
                <div className="px-4 pb-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        <th className="text-left py-2 pr-3">Variable</th>
                        <th className="text-center py-2 px-2">N</th>
                        <th className="text-center py-2 px-2">Mean</th>
                        <th className="text-center py-2 px-2">SD</th>
                        <th className="text-center py-2 px-2">Median</th>
                        <th className="text-center py-2 px-2">IQR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vars.map(v => (
                        <tr key={v.variable} className="border-b border-gray-800/50">
                          <td className="py-1.5 pr-3 text-gray-300">{v.label || v.variable}</td>
                          <td className="text-center py-1.5 px-2 text-gray-500 font-mono">{v.n}</td>
                          <td className="text-center py-1.5 px-2 font-mono font-bold" style={{ color: cellColor(v.mean) }}>{v.mean?.toFixed(2)}</td>
                          <td className="text-center py-1.5 px-2 text-gray-400 font-mono">{v.sd?.toFixed(2)}</td>
                          <td className="text-center py-1.5 px-2 text-gray-400 font-mono">{v.median?.toFixed(1)}</td>
                          <td className="text-center py-1.5 px-2 text-gray-400 font-mono">{v.iqr?.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        );
      })}

      {/* ── Model Comparison Likert (pairwise Mann-Whitney U) ── */}
      {(byType["model_comparison_likert"] || []).map((item: any, i: number) => {
        const pairwise = (item.results?.pairwise || []) as Array<{ comparison: string; variable: string; label: string; mean_1: number; mean_2: number; U: number; p: number; effect_size: number; significant: boolean }>;
        if (pairwise.length === 0) return null;
        const sigCount = pairwise.filter(r => r.significant).length;
        return (
          <div key={`mwu-${i}`}>
            <SectionHeader>Pairwise Model Comparison (Mann-Whitney U)</SectionHeader>
            <div className="flex gap-3 mb-3">
              <StatCard label="Comparisons" value={pairwise.length} />
              <StatCard label="Significant (p<0.05)" value={sigCount} />
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 pr-2">Comparison</th>
                    <th className="text-left py-2 pr-2">Variable</th>
                    <th className="text-center py-2 px-2">Mean 1</th>
                    <th className="text-center py-2 px-2">Mean 2</th>
                    <th className="text-center py-2 px-2">U</th>
                    <th className="text-center py-2 px-2">p</th>
                    <th className="text-center py-2 px-2">Effect</th>
                  </tr>
                </thead>
                <tbody>
                  {pairwise.filter(r => r.significant).concat(pairwise.filter(r => !r.significant)).slice(0, 25).map((r, j) => (
                    <tr key={j} className={`border-b border-gray-800/50 ${r.significant ? "bg-yellow-950/10" : ""}`}>
                      <td className="py-1.5 pr-2 text-gray-400 font-mono text-[10px]">{r.comparison}</td>
                      <td className="py-1.5 pr-2 text-gray-300">{r.label || r.variable}</td>
                      <td className="text-center py-1.5 px-2 font-mono text-gray-300">{r.mean_1?.toFixed(2)}</td>
                      <td className="text-center py-1.5 px-2 font-mono text-gray-300">{r.mean_2?.toFixed(2)}</td>
                      <td className="text-center py-1.5 px-2 font-mono text-gray-500">{r.U?.toFixed(0)}</td>
                      <td className={`text-center py-1.5 px-2 font-mono ${r.significant ? "text-yellow-400 font-bold" : "text-gray-500"}`}>{r.p?.toFixed(4)}</td>
                      <td className="text-center py-1.5 px-2 font-mono text-gray-400">{r.effect_size?.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pairwise.length > 25 && <p className="text-xs text-gray-600 mt-2">Showing 25 of {pairwise.length} (significant first)</p>}
            </div>
          </div>
        );
      })}

      {/* ── Kruskal-Wallis H Test ── */}
      {(byType["kruskal_wallis"] || []).map((item: any, i: number) => {
        const kwResults = (item.results?.results || []) as Array<{ variable: string; label: string; means: Record<string, number>; H: number; p: number; epsilon_sq: number; significant: boolean }>;
        if (kwResults.length === 0) return null;
        const mNames = kwResults[0]?.means ? Object.keys(kwResults[0].means) : [];
        return (
          <div key={`kw-${i}`}>
            <SectionHeader>Kruskal-Wallis H Test (3-Model)</SectionHeader>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 pr-2">Variable</th>
                    {mNames.map(m => <th key={m} className="text-center py-2 px-2">{m.split("/").pop()}</th>)}
                    <th className="text-center py-2 px-2">H</th>
                    <th className="text-center py-2 px-2">p</th>
                    <th className="text-center py-2 px-2">{"\u03B5\u00B2"}</th>
                  </tr>
                </thead>
                <tbody>
                  {kwResults.map((r, j) => (
                    <tr key={j} className={`border-b border-gray-800/50 ${r.significant ? "bg-yellow-950/10" : ""}`}>
                      <td className="py-1.5 pr-2 text-gray-300">{r.label || r.variable}</td>
                      {mNames.map(m => (
                        <td key={m} className="text-center py-1.5 px-2 font-mono" style={{ color: cellColor(r.means?.[m] ?? 0) }}>{r.means?.[m]?.toFixed(2) ?? "\u2014"}</td>
                      ))}
                      <td className="text-center py-1.5 px-2 font-mono text-gray-500">{r.H?.toFixed(2)}</td>
                      <td className={`text-center py-1.5 px-2 font-mono ${r.significant ? "text-yellow-400 font-bold" : "text-gray-500"}`}>{r.p?.toFixed(4)}</td>
                      <td className="text-center py-1.5 px-2 font-mono text-gray-400">{r.epsilon_sq?.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* ── Barrier Heatmap ── */}
      {(byType["barrier_heatmap"] || []).map((item: any, i: number) => {
        const matrix = item.results?.matrix as Record<string, Record<string, number>> | undefined;
        if (!matrix) return null;
        const segs = Object.keys(matrix);
        const barriers = segs.length > 0 ? Object.keys(matrix[segs[0]]) : [];
        // Build chart data for grouped bar
        const chartData = barriers.map(b => {
          const row: Record<string, string | number> = { barrier: b.length > 16 ? b.slice(0, 14) + "\u2026" : b };
          segs.forEach(s => { row[s] = matrix[s][b] ?? 0; });
          return row;
        });
        const segColors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
        return (
          <div key={`bh-${i}`}>
            <SectionHeader>Barrier Heatmap (Segment {"\u00D7"} Barrier)</SectionHeader>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="barrier" tick={{ fill: "#9ca3af", fontSize: 9 }} />
                  <YAxis domain={[0, 5]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {segs.map((s, si) => (
                    <RBar key={s} dataKey={s} fill={segColors[si % segColors.length]} radius={[2, 2, 0, 0]}
                      name={s.length > 18 ? s.slice(0, 16) + "\u2026" : s} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}

      {/* ── Segment Profiles ── */}
      {(byType["segment_profiles"] || []).map((item: any, i: number) => {
        const profiles = item.results?.profiles as Record<string, Record<string, number>> | undefined;
        if (!profiles) return null;
        const segs = Object.keys(profiles);
        const vars = segs.length > 0 ? Object.keys(profiles[segs[0]]).slice(0, 12) : [];
        const chartData = vars.map(v => {
          const row: Record<string, string | number> = { variable: v.length > 20 ? v.slice(0, 18) + "\u2026" : v };
          segs.forEach(s => { row[s] = profiles[s][v] ?? 0; });
          return row;
        });
        const segColors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
        return (
          <div key={`sp-${i}`}>
            <SectionHeader>Segment Profiles</SectionHeader>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <ResponsiveContainer width="100%" height={Math.max(250, vars.length * 28)}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 130 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" domain={[0, 5]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis type="category" dataKey="variable" tick={{ fill: "#9ca3af", fontSize: 10 }} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {segs.map((s, si) => (
                    <RBar key={s} dataKey={s} fill={segColors[si % segColors.length]} radius={[0, 3, 3, 0]}
                      name={s.length > 18 ? s.slice(0, 16) + "\u2026" : s} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}

      {/* ── Descriptive Categorical ── */}
      {(byType["descriptive_categorical"] || []).map((item: any, i: number) => {
        const catData = item.results?.data as Record<string, Record<string, Record<string, { count: number; pct: number }>>> | undefined;
        if (!catData) return null;
        const catKeys = Object.keys(catData).slice(0, 6);
        return (
          <div key={`cat-${i}`} className="space-y-4">
            <SectionHeader>Categorical Distributions (by {item.results?.by || "segment"})</SectionHeader>
            {catKeys.map(catKey => {
              const segments = catData[catKey];
              const segNames = Object.keys(segments);
              const allValues = [...new Set(segNames.flatMap(s => Object.keys(segments[s])))].slice(0, 10);
              return (
                <details key={catKey} className="bg-gray-800/40 border border-gray-700 rounded-lg">
                  <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-white hover:bg-gray-800/60 rounded-lg">
                    {catKey} <span className="text-gray-500 ml-1">({allValues.length} values {"\u00D7"} {segNames.length} segments)</span>
                  </summary>
                  <div className="px-4 pb-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="text-left py-2 pr-2">Value</th>
                          {segNames.map(s => <th key={s} className="text-center py-2 px-2">{s}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {allValues.map(val => (
                          <tr key={val} className="border-b border-gray-800/50">
                            <td className="py-1.5 pr-2 text-gray-300">{val}</td>
                            {segNames.map(s => {
                              const entry = segments[s]?.[val];
                              return (
                                <td key={s} className="text-center py-1.5 px-2 text-gray-400">
                                  {entry ? <span className="font-mono">{entry.pct.toFixed(1)}%</span> : "\u2014"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        );
      })}

      {/* ── Inter-LLM Reliability (STAMP) ── */}
      {(byType["inter_llm_reliability"] || []).map((item: any, i: number) => {
        const data = item.results || {};
        const variables = (data.variables || []) as Array<{ variable: string; label: string; alpha: number; passes_threshold: boolean; interpretation: string }>;
        const overallAlpha = data.overall_alpha as number;
        const passesStamp = data.passes_stamp_threshold as boolean;
        return (
          <div key={`ilr-${i}`} className="space-y-4">
            <SectionHeader>Inter-LLM Reliability (STAMP)</SectionHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Overall Alpha" value={overallAlpha?.toFixed(3) ?? "—"} />
              <StatCard label="STAMP Threshold" value={passesStamp ? "✓ PASS (≥0.667)" : "✗ FAIL"} />
              <StatCard label="Interpretation" value={data.overall_interpretation ?? "—"} />
              <StatCard label="Models" value={(data.models as string[])?.length ?? 0} />
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <ResponsiveContainer width="100%" height={Math.max(250, variables.length * 22)}>
                <BarChart data={variables.map(v => ({ ...v, name: v.label || v.variable }))} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 130 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" domain={[0, 1]} tick={{ fill: "#9ca3af", fontSize: 11 }}
                    ticks={[0, 0.2, 0.4, 0.667, 0.8, 1.0]} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    formatter={(value) => [Number(value)?.toFixed(4), "α"]} />
                  <RBar dataKey="alpha" radius={[0, 3, 3, 0]}
                    fill="#3b82f6"
                    label={{ position: "right", fill: "#9ca3af", fontSize: 10, formatter: (v: unknown) => Number(v)?.toFixed(3) }} />
                  {/* Reference line at STAMP threshold would be nice but simple bar works */}
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <span className="inline-block w-3 h-0.5 bg-yellow-500"></span>
                <span>STAMP threshold: α ≥ 0.667</span>
              </div>
            </div>
            <details className="bg-gray-800/40 border border-gray-700 rounded-lg">
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-white hover:bg-gray-800/60 rounded-lg">
                Variable Detail ({variables.length} variables)
              </summary>
              <div className="px-4 pb-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                      <th className="text-left py-2 pr-2">Variable</th>
                      <th className="text-center py-2 px-2">Alpha</th>
                      <th className="text-center py-2 px-2">Threshold</th>
                      <th className="text-center py-2 px-2">Interpretation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((v, j) => (
                      <tr key={j} className={`border-b border-gray-800/50 ${v.passes_threshold ? "" : "bg-red-950/10"}`}>
                        <td className="py-1.5 pr-2 text-gray-300">{v.label || v.variable}</td>
                        <td className={`text-center py-1.5 px-2 font-mono font-bold ${v.passes_threshold ? "text-green-400" : "text-red-400"}`}>
                          {v.alpha?.toFixed(4)}
                        </td>
                        <td className="text-center py-1.5 px-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${v.passes_threshold ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                            {v.passes_threshold ? "PASS" : "FAIL"}
                          </span>
                        </td>
                        <td className="text-center py-1.5 px-2 text-gray-400 capitalize">{v.interpretation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        );
      })}

      {/* ── Benchmark Comparison (Synthetic vs Real) ── */}
      {(byType["benchmark_comparison"] || []).map((item: any, i: number) => {
        const comparisons = (item.results?.comparisons || []) as Array<{
          question: string; ourQ: string;
          synthetic: Record<string, { count: number; pct: number }>;
          real: Record<string, { count?: number; pct: number; label?: string }>;
          delta: Record<string, number>;
          syntheticN: number; realN: number;
        }>;
        return (
          <div key={`bench-${i}`} className="space-y-4">
            <SectionHeader>Benchmark Comparison — Synthetic vs Real (N=600)</SectionHeader>
            <p className="text-xs text-gray-500">Comparing synthetic survey distributions against real aytm survey results.</p>
            {comparisons.map((comp, ci) => {
              const keys = Object.keys(comp.delta);
              const chartData = keys.map(k => ({
                label: k.length > 25 ? k.slice(0, 23) + "…" : k,
                Synthetic: comp.synthetic[k]?.pct ?? 0,
                Real: (comp.real[k] as any)?.pct ?? 0,
              }));
              const maxAbsDelta = Math.max(...Object.values(comp.delta).map(Math.abs));
              return (
                <div key={ci} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{comp.question}</h4>
                      <p className="text-xs text-gray-500">Question {comp.ourQ} | Synthetic N={comp.syntheticN} vs Real N={comp.realN}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-mono ${maxAbsDelta <= 5 ? "bg-green-900/40 text-green-400" : maxAbsDelta <= 15 ? "bg-yellow-900/40 text-yellow-400" : "bg-red-900/40 text-red-400"}`}>
                      Max Δ: {maxAbsDelta.toFixed(1)}pp
                    </span>
                  </div>
                  {chartData.length <= 10 && (
                    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 35)}>
                      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 140 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} unit="%" />
                        <YAxis type="category" dataKey="label" tick={{ fill: "#9ca3af", fontSize: 9 }} width={130} />
                        <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                          formatter={(value) => [`${Number(value).toFixed(1)}%`]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <RBar dataKey="Synthetic" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                        <RBar dataKey="Real" fill="#22c55e" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  {/* Delta table */}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="text-left py-2 pr-2">Value</th>
                          <th className="text-center py-2 px-2">Synthetic</th>
                          <th className="text-center py-2 px-2">Real</th>
                          <th className="text-center py-2 px-2">Delta (pp)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keys.map(k => {
                          const d = comp.delta[k];
                          return (
                            <tr key={k} className="border-b border-gray-800/50">
                              <td className="py-1.5 pr-2 text-gray-300">{k}</td>
                              <td className="text-center py-1.5 px-2 font-mono text-blue-400">{(comp.synthetic[k]?.pct ?? 0).toFixed(1)}%</td>
                              <td className="text-center py-1.5 px-2 font-mono text-green-400">{((comp.real[k] as any)?.pct ?? 0).toFixed(1)}%</td>
                              <td className={`text-center py-1.5 px-2 font-mono font-bold ${Math.abs(d) <= 5 ? "text-gray-400" : Math.abs(d) <= 15 ? "text-yellow-400" : "text-red-400"}`}>
                                {d > 0 ? "+" : ""}{d.toFixed(1)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ── Disagreement Analysis (STAMP) ── */}
      {(byType["disagreement_analysis"] || []).map((item: any, i: number) => {
        const data = item.results || {};
        const disagreements = (data.disagreements || []) as Array<{
          variable: string; label: string;
          model_means: Record<string, number>;
          max_difference: number;
          highest: { model: string; mean: number };
          lowest: { model: string; mean: number };
          interpretation: string;
        }>;
        return (
          <div key={`da-${i}`} className="space-y-4">
            <SectionHeader>Model Disagreement Analysis (STAMP)</SectionHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Variables Analyzed" value={data.total_variables ?? 0} />
              <StatCard label="With Disagreement" value={data.variables_with_disagreement ?? 0} />
              <StatCard label="Disagreement Rate" value={data.total_variables ? `${Math.round((data.variables_with_disagreement / data.total_variables) * 100)}%` : "—"} />
            </div>
            <p className="text-xs text-gray-500 italic">{data.methodology}</p>
            {disagreements.length === 0 ? (
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 text-sm text-green-400">
                No significant model disagreements detected (all mean differences ≤ 0.5).
              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                      <th className="text-left py-2 pr-2">Variable</th>
                      <th className="text-center py-2 px-2">Max Δ</th>
                      <th className="text-left py-2 px-2">Highest</th>
                      <th className="text-left py-2 px-2">Lowest</th>
                      <th className="text-center py-2 px-2">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disagreements.map((d, j) => (
                      <tr key={j} className="border-b border-gray-800/50">
                        <td className="py-1.5 pr-2 text-gray-300">{d.label || d.variable}</td>
                        <td className={`text-center py-1.5 px-2 font-mono font-bold ${d.max_difference > 1 ? "text-red-400" : d.max_difference > 0.75 ? "text-yellow-400" : "text-orange-400"}`}>
                          {d.max_difference?.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 text-gray-400">
                          <span className="font-mono text-blue-400">{d.highest?.mean?.toFixed(2)}</span>
                          <span className="ml-1 text-gray-600">({d.highest?.model})</span>
                        </td>
                        <td className="py-1.5 px-2 text-gray-400">
                          <span className="font-mono text-red-400">{d.lowest?.mean?.toFixed(2)}</span>
                          <span className="ml-1 text-gray-600">({d.lowest?.model})</span>
                        </td>
                        <td className="text-center py-1.5 px-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                            d.interpretation === "strong_disagreement" ? "bg-red-900/40 text-red-400" :
                            d.interpretation === "moderate_disagreement" ? "bg-yellow-900/40 text-yellow-400" :
                            "bg-orange-900/40 text-orange-400"
                          }`}>
                            {d.interpretation?.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}


      {/* ── STAMP Interpretation Agreement ── */}
      {byType["stamp_interpretation_agreement"]?.map((item: any, i: number) => {
        const d = item.results || {};

        // Handle failure case
        if (d.status === "failed") {
          return (
            <div key={`stamp-interp-${i}`} className="mb-6">
              <SectionHeader>STAMP Interpretation Agreement</SectionHeader>
              <div className="bg-red-950/20 border border-red-800 rounded-lg p-4 space-y-2">
                <span className="text-xs font-medium text-red-400 uppercase tracking-wider">Failed</span>
                <p className="text-sm text-red-300">{d.message}</p>
                {(d.failures || []).length > 0 && (
                  <div className="space-y-1">
                    {d.failures.map((f: { model: string; error: string }, idx: number) => (
                      <div key={idx} className="text-xs text-red-400/70">{f.model}: {f.error?.slice(0, 100)}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }

        const agreementRate = d.agreement_rate ?? 0;
        const fields = (d.classification_fields || []) as Array<{ field: string; values: Record<string, string>; unanimous: boolean; unique_answers: number }>;
        const passesStamp = d.passes_stamp;

        return (
          <div key={`stamp-interp-${i}`} className="mb-6">
            <SectionHeader>STAMP Interpretation Agreement</SectionHeader>
            <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">3-Model Agreement</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${passesStamp ? 'bg-emerald-900/50 text-emerald-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                  {agreementRate}% agreement{passesStamp ? ' — PASSES' : ''}
                </span>
              </div>
              <p className="text-xs text-gray-500">{d.methodology}</p>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{d.unanimous_fields}/{d.total_fields}</div>
                  <div className="text-[10px] text-gray-500">Unanimous</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{agreementRate}%</div>
                  <div className="text-[10px] text-gray-500">Agreement Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{d.interpretation_alpha?.toFixed(3) ?? '—'}</div>
                  <div className="text-[10px] text-gray-500">Interp. α</div>
                </div>
              </div>
              {fields.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        <th className="text-left py-2">Classification</th>
                        {(d.models || []).map((m: string) => <th key={m} className="text-center py-2">{m}</th>)}
                        <th className="text-center py-2">Agree?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f) => (
                        <tr key={f.field} className="border-b border-gray-800/50">
                          <td className="py-1.5 text-gray-400">{f.field.replace(/_/g, ' ')}</td>
                          {(d.models || []).map((m: string) => (
                            <td key={m} className="text-center py-1.5 text-gray-300">{f.values[m] || '—'}</td>
                          ))}
                          <td className="text-center py-1.5">
                            {f.unanimous ? <span className="text-emerald-400">✓</span> : <span className="text-yellow-400">✗</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })}


      {/* ── Survey Coverage Validation (from Stage 3) ── */}
      {(byType["survey_coverage_validation"] || []).map((item: any, i: number) => {
        const d = item.results || {};
        return (
          <div key={`scv-${i}`} className="space-y-4">
            <SectionHeader>Survey Coverage Validation</SectionHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Hardcoded Questions" value={d.hardcoded_question_count ?? 0} />
              <StatCard label="Matched" value={d.matched_questions ?? 0} />
              <StatCard label="Coverage Score" value={d.coverage_score != null ? `${d.coverage_score}%` : "—"} />
              <StatCard label="Models Used" value={(d.models_used || []).length} />
            </div>
            {(d.gap_sections || []).length > 0 && (
              <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Gap Sections (proposed by models but not in instrument)</h4>
                <div className="flex flex-wrap gap-2">
                  {d.gap_sections.map((s: string, j: number) => (
                    <span key={j} className="text-xs px-2 py-1 rounded bg-amber-900/30 text-amber-300">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-500 italic">{d.methodology}</p>
          </div>
        );
      })}

      {/* ── Fallback for unknown types ── */}
      {Object.entries(byType)
        .filter(([type]) => !["cross_tabulation", "descriptive_likert", "model_comparison_likert", "kruskal_wallis", "barrier_heatmap", "segment_profiles", "descriptive_categorical", "inter_llm_reliability", "benchmark_comparison", "disagreement_analysis", "stamp_emotion_classification", "stamp_theme_extraction", "stamp_interpretation_agreement", "survey_coverage_validation"].includes(type))
        .map(([type, items]) => (
          <div key={type}>
            <SectionHeader>{type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SectionHeader>
            {items.map((item: any, i: number) => (
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
