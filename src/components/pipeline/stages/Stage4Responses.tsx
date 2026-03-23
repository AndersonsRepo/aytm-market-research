"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { getSupabaseClient } from "@/lib/supabase/client";
import { SectionHeader, StatCard, LoadingSpinner, Bar } from "../ui";

const BARRIER_KEYS: Record<string, string> = {
  Q5_cost: "Cost (~$23K)",
  Q5_hoa: "HOA Restrictions",
  Q5_permit: "Permit Uncertainty",
  Q5_space: "Limited Space",
  Q5_financing: "Lack of Financing",
  Q5_quality: "Build Quality",
  Q5_resale: "Resale Value",
};

const CONCEPT_KEYS: Record<string, string> = {
  Q9a: "Home Office",
  Q10a: "Guest Suite",
  Q11a: "Wellness Studio",
  Q12a: "Adventure",
  Q13a: "Simplicity",
};

const RADAR_VARS: Record<string, string> = {
  Q1: "Purchase Int.",
  Q2: "Purchase Lik.",
  Q7: "Permit Effect",
  Q15: "V: Permit",
  Q16: "V: Speed",
  Q17: "V: Quality",
};

const SEGMENT_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

// Helper to safely get a numeric value from response JSONB
function getNum(responses: Record<string, any>, key: string): number | null {
  const v = responses?.[key];
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function Stage4Responses({ runId }: { runId: string }) {
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.from("survey_responses")
      .select("id, model, segment_id, segment_name, respondent_id, responses")
      .eq("run_id", runId)
      .then(({ data }) => {
        setResponses(data || []);
        setLoading(false);
      });
  }, [runId]);

  const models = useMemo(() => [...new Set(responses.map(r => r.model))].sort(), [responses]);
  const segments = useMemo(() => [...new Set(responses.map(r => r.segment_name))].sort(), [responses]);

  // ── Purchase Interest by Segment ──
  const purchaseData = useMemo(() => {
    return segments.map(seg => {
      const segResponses = responses.filter(r => r.segment_name === seg);
      const q1Vals = segResponses.map(r => getNum(r.responses, "Q1")).filter((v): v is number => v != null);
      const q2Vals = segResponses.map(r => getNum(r.responses, "Q2")).filter((v): v is number => v != null);
      return {
        segment: seg.length > 18 ? seg.slice(0, 16) + "…" : seg,
        "Purchase Interest": q1Vals.length > 0 ? +(q1Vals.reduce((a, b) => a + b, 0) / q1Vals.length).toFixed(2) : 0,
        "Purchase Likelihood": q2Vals.length > 0 ? +(q2Vals.reduce((a, b) => a + b, 0) / q2Vals.length).toFixed(2) : 0,
      };
    });
  }, [responses, segments]);

  // ── Barrier Heatmap Data ──
  const barrierData = useMemo(() => {
    return segments.map(seg => {
      const segResponses = responses.filter(r => r.segment_name === seg);
      const row: Record<string, string | number> = { segment: seg.length > 18 ? seg.slice(0, 16) + "…" : seg };
      Object.keys(BARRIER_KEYS).forEach(key => {
        const vals = segResponses.map(r => getNum(r.responses, key)).filter((v): v is number => v != null);
        row[BARRIER_KEYS[key]] = vals.length > 0 ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0;
      });
      return row;
    });
  }, [responses, segments]);

  // ── Concept Appeal by Segment ──
  const conceptData = useMemo(() => {
    return segments.map(seg => {
      const segResponses = responses.filter(r => r.segment_name === seg);
      const row: Record<string, string | number> = { segment: seg.length > 18 ? seg.slice(0, 16) + "…" : seg };
      Object.entries(CONCEPT_KEYS).forEach(([key, label]) => {
        const vals = segResponses.map(r => getNum(r.responses, key)).filter((v): v is number => v != null);
        row[label] = vals.length > 0 ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0;
      });
      return row;
    });
  }, [responses, segments]);

  // ── Segment Radar Data ──
  const radarData = useMemo(() => {
    return Object.entries(RADAR_VARS).map(([key, label]) => {
      const row: Record<string, string | number> = { variable: label };
      segments.forEach(seg => {
        const segResponses = responses.filter(r => r.segment_name === seg);
        const vals = segResponses.map(r => getNum(r.responses, key)).filter((v): v is number => v != null);
        const shortSeg = seg.length > 14 ? seg.slice(0, 12) + "…" : seg;
        row[shortSeg] = vals.length > 0 ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0;
      });
      return row;
    });
  }, [responses, segments]);

  // ── Model distribution ──
  const modelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    responses.forEach(r => {
      const m = (r.model as string).split("/").pop() || r.model;
      counts[m] = (counts[m] || 0) + 1;
    });
    return counts;
  }, [responses]);

  if (loading) return <LoadingSpinner />;

  const maxModel = Math.max(...Object.values(modelCounts), 1);

  return (
    <div className="space-y-6">
      {/* ── Overview Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Respondents" value={responses.length} />
        <StatCard label="Segments" value={segments.length} />
        <StatCard label="Models Used" value={models.length} />
        <StatCard label="Per Segment" value={segments.length > 0 ? Math.round(responses.length / segments.length) : 0} />
      </div>

      {/* ── Purchase Interest by Segment ── */}
      <div>
        <SectionHeader>Purchase Interest & Likelihood by Segment</SectionHeader>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={purchaseData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="segment" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis domain={[0, 5]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <RBar dataKey="Purchase Interest" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <RBar dataKey="Purchase Likelihood" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts Row: Barriers + Concept Appeal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Barrier Heatmap as grouped bar */}
        <div>
          <SectionHeader>Barrier Severity by Segment</SectionHeader>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2 text-gray-400">Segment</th>
                  {Object.values(BARRIER_KEYS).map(label => (
                    <th key={label} className="text-center py-2 px-1 text-gray-400 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {barrierData.map((row, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-1.5 px-2 text-gray-300 font-medium">{row.segment}</td>
                    {Object.values(BARRIER_KEYS).map(label => {
                      const val = row[label] as number;
                      const intensity = Math.max(0, Math.min(1, (val - 1) / 4));
                      const r = Math.round(200 * intensity + 55 * (1 - intensity));
                      const g = Math.round(50 * intensity + 200 * (1 - intensity));
                      return (
                        <td key={label} className="py-1.5 px-1 text-center">
                          <span className="inline-block w-10 h-6 rounded text-[10px] font-mono font-bold leading-6"
                            style={{
                              backgroundColor: `rgba(${r}, ${g}, 50, 0.3)`,
                              color: `rgb(${r}, ${g}, 80)`,
                            }}>
                            {val.toFixed(1)}
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

        {/* Concept Appeal */}
        <div>
          <SectionHeader>Concept Appeal by Segment</SectionHeader>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={conceptData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="segment" tick={{ fill: "#9ca3af", fontSize: 9 }} />
                <YAxis domain={[0, 5]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {Object.values(CONCEPT_KEYS).map((label, i) => (
                  <RBar key={label} dataKey={label} fill={SEGMENT_COLORS[i]} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Segment Profile Radar ── */}
      <div>
        <SectionHeader>Segment Profile Comparison</SectionHeader>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="variable" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <PolarRadiusAxis domain={[1, 5]} tick={{ fill: "#6b7280", fontSize: 10 }} />
              {segments.map((seg, i) => {
                const shortSeg = seg.length > 14 ? seg.slice(0, 12) + "…" : seg;
                return (
                  <Radar key={seg} name={seg} dataKey={shortSeg}
                    stroke={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                    fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                    fillOpacity={0.1} strokeWidth={2} />
                );
              })}
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Model Distribution ── */}
      <div>
        <SectionHeader>Respondents by Model</SectionHeader>
        <div className="space-y-2">
          {Object.entries(modelCounts).map(([model, count]) => (
            <Bar key={model} label={model} value={count} max={maxModel} color="bg-cyan-500" />
          ))}
        </div>
      </div>
    </div>
  );
}
