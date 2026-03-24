"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import { getSupabaseClient } from "@/lib/supabase/client";
import { SectionHeader, StatCard, LoadingSpinner, Tag } from "../ui";

const TYPE_COLORS: Record<string, string> = {
  likert_5: "#3b82f6",
  likert_interest: "#22c55e",
  likert_likelihood: "#14b8a6",
  single_choice: "#f59e0b",
  multi_choice: "#f97316",
  ranking: "#8b5cf6",
  open_end: "#ec4899",
  screening: "#6b7280",
};

export function Stage3Survey({ runId }: { runId: string }) {
  const [designs, setDesigns] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    Promise.all([
      supabase.from("survey_designs").select("*").eq("run_id", runId),
      supabase.from("survey_coverage").select("*").eq("run_id", runId),
    ]).then(([dRes, cRes]) => {
      setDesigns(dRes.data || []);
      setCoverage(cRes.data || []);
      setLoading(false);
    });
  }, [runId]);

  const models = useMemo(() => [...new Set(designs.map(d => d.model))].sort(), [designs]);
  const activeModel = selectedModel || models[0] || null;
  const activeDesign = useMemo(() => designs.find(d => d.model === activeModel), [designs, activeModel]);

  // Question type distribution for selected model
  const typeDist = useMemo(() => {
    if (!activeDesign?.design) return [];
    const counts: Record<string, number> = {};
    const sections = activeDesign.design.sections || activeDesign.design.survey_sections || [];
    sections.forEach((s: any) => {
      (s.questions || []).forEach((q: any) => {
        const t = q.type || "unknown";
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([type, count]) => ({
      name: type.replace(/_/g, " "),
      value: count,
      fill: TYPE_COLORS[type] || "#6b7280",
    }));
  }, [activeDesign]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Model Variants" value={designs.length} />
        <StatCard label="Avg Questions"
          value={designs.length > 0 ? Math.round(designs.reduce((s, d) => s + (d.total_questions || 0), 0) / designs.length) : 0} />
        <StatCard label="Est. Survey Time"
          value={`${designs.length > 0 ? Math.round(designs.reduce((s, d) => s + (d.estimated_duration_minutes || 0), 0) / designs.length) : 0}m`} />
      </div>

      {/* Coverage Matrix */}
      {coverage.length > 0 && (
        <div>
          <SectionHeader>Cross-Model Section Coverage</SectionHeader>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Section</th>
                  {models.map(m => (
                    <th key={m} className="text-center py-2 px-3 text-gray-400 font-medium">
                      {(m as string).split("/").pop()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coverage.map((c, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-2 px-3 text-gray-300 font-medium">{c.section_label}</td>
                    {models.map(m => {
                      const included = (c.models_including || []).includes(m);
                      const count = c.question_counts?.[m] || c.question_counts?.[(m as string).split("/").pop() || ""] || 0;
                      return (
                        <td key={m} className="py-2 px-3 text-center">
                          {included ? (
                            <span className="inline-block w-8 h-6 rounded bg-emerald-900/30 text-emerald-400 text-xs font-mono font-bold leading-6">
                              {count || "✓"}
                            </span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
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

      {/* Model selector + Question type pie + Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model selector + type distribution */}
        <div>
          <SectionHeader>Question Types</SectionHeader>
          <div className="flex gap-2 mb-3">
            {models.map(m => (
              <button key={m} onClick={() => setSelectedModel(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeModel === m ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}>
                {(m as string).split("/").pop()}
              </button>
            ))}
          </div>
          {typeDist.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={typeDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {typeDist.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Survey structure cards */}
        <div className="lg:col-span-2">
          <SectionHeader>Survey Structure</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {designs.map((d, i) => {
              const design = d.design || {};
              const sections = design.sections || design.survey_sections || [];
              return (
                <div key={i} className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag>{(d.model as string).split("/").pop()}</Tag>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1 mb-2">
                    <div>Questions: <span className="text-white font-mono">{d.total_questions || "—"}</span></div>
                    <div>Est. Survey Time: <span className="text-white font-mono">{d.estimated_duration_minutes || "—"}m</span></div>
                  </div>
                  {Array.isArray(sections) && sections.length > 0 && (
                    <div className="space-y-0.5">
                      {sections.slice(0, 6).map((s: any, j: number) => (
                        <div key={j} className="text-xs text-gray-500 truncate">
                          {j + 1}. {s.title || s.name || s.label || s.section_title || `Section ${j + 1}`}
                        </div>
                      ))}
                      {sections.length > 6 && <div className="text-xs text-gray-600">+{sections.length - 6} more</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Instrument Browser */}
      {activeDesign?.design && (
        <div>
          <SectionHeader>Instrument Browser — {(activeModel as string).split("/").pop()}</SectionHeader>
          <div className="space-y-3">
            {(activeDesign.design.sections || activeDesign.design.survey_sections || []).map((section: any, i: number) => (
              <details key={i} className="bg-gray-800/40 border border-gray-700 rounded-lg">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-white hover:bg-gray-800/60 rounded-lg">
                  {section.title || section.name || section.label || `Section ${i + 1}`}
                  <span className="text-gray-500 ml-2">({(section.questions || []).length} questions)</span>
                </summary>
                <div className="px-4 pb-3 space-y-2">
                  {section.purpose && <p className="text-xs text-gray-500 italic">{section.purpose}</p>}
                  {(section.questions || []).map((q: any, j: number) => (
                    <div key={j} className="flex items-start gap-3 py-1.5 border-t border-gray-800/50">
                      <span className="text-xs text-gray-600 font-mono w-8 shrink-0">{q.id || `Q${j + 1}`}</span>
                      <div className="flex-1">
                        <p className="text-xs text-gray-300">{q.text || q.question_text}</p>
                        <div className="flex gap-2 mt-1">
                          <Tag color={`${TYPE_COLORS[q.type] ? '' : 'bg-gray-700'} text-gray-400`}>
                            {(q.type || "unknown").replace(/_/g, " ")}
                          </Tag>
                          {q.source_theme && (
                            <span className="text-[10px] text-gray-600 truncate max-w-[200px]">
                              ← {q.source_theme}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
