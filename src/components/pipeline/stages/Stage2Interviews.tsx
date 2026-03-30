"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend,
} from "recharts";
import { getSupabaseClient } from "@/lib/supabase/client";
import { SectionHeader, StatCard, LoadingSpinner, Tag } from "../ui";

const QUESTION_LABELS: Record<string, string> = {
  IQ1: "Backyard Relationship",
  IQ2: "Unmet Needs",
  IQ3: "Prior Consideration",
  IQ4: "Lifestyle Fantasy",
  IQ5: "Work-Life Boundaries",
  IQ6: "Product Reaction",
  IQ7: "Barriers & Drivers",
  IQ8: "Social & Discovery",
};

const EMOTION_COLORS: Record<string, string> = {
  excitement: "#22c55e",
  curiosity: "#3b82f6",
  aspiration: "#8b5cf6",
  pragmatism: "#eab308",
  skepticism: "#f97316",
  anxiety: "#ef4444",
  frustration: "#dc2626",
  indifference: "#6b7280",
};

const MODEL_COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];

// Sentiment color: -1 (red) to 0 (gray) to +1 (green)
function sentimentColor(value: number): string {
  if (value >= 0.5) return "#166534";
  if (value >= 0.2) return "#16a34a";
  if (value >= 0.05) return "#86efac";
  if (value > -0.05) return "#6b7280";
  if (value > -0.2) return "#fca5a5";
  if (value > -0.5) return "#ef4444";
  return "#991b1b";
}

export function Stage2Interviews({ runId }: { runId: string }) {
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any[]>([]);
  const [themes, setThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    Promise.all([
      supabase.from("interview_transcripts").select("*").eq("run_id", runId),
      supabase.from("interview_analysis").select("*").eq("run_id", runId),
      supabase.from("interview_themes").select("*").eq("run_id", runId).order("frequency", { ascending: false }),
    ]).then(([tRes, aRes, thRes]) => {
      setTranscripts(tRes.data || []);
      setAnalysis(aRes.data || []);
      setThemes(thRes.data || []);
      setLoading(false);
    });
  }, [runId]);

  // ── Derived data ──
  const models = useMemo(() => [...new Set(transcripts.map(t => t.model))].sort(), [transcripts]);

  const sentiments = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0 };
    analysis.forEach(a => {
      const compound = a.sentiment_scores?.compound ?? a.sentiment_scores?.overall ?? 0;
      if (compound >= 0.05) counts.positive++;
      else if (compound <= -0.05) counts.negative++;
      else counts.neutral++;
    });
    return counts;
  }, [analysis]);

  const emotionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    analysis.forEach(a => {
      if (a.primary_emotion) {
        counts[a.primary_emotion] = (counts[a.primary_emotion] || 0) + 1;
      }
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [analysis]);

  // ── Sentiment heatmap data ──
  const heatmapData = useMemo(() => {
    // Build a map: interview_id → analysis
    const analysisMap: Record<string, any> = {};
    analysis.forEach(a => { analysisMap[a.interview_id] = a; });

    return transcripts.map(t => {
      const a = analysisMap[t.interview_id];
      const scores = a?.sentiment_scores || {};
      const row: Record<string, any> = {
        persona: t.persona_name || t.persona_id,
        model: t.model,
      };
      Object.keys(QUESTION_LABELS).forEach(q => {
        row[q] = scores[q] ?? scores[q.toLowerCase()] ?? null;
      });
      return row;
    });
  }, [transcripts, analysis]);

  // ── Emotion radar data (by model) ──
  const radarData = useMemo(() => {
    const allEmotions = Object.keys(EMOTION_COLORS);
    return allEmotions.map(emotion => {
      const row: Record<string, string | number> = { emotion };
      models.forEach(m => {
        const modelAnalysis = analysis.filter(a => {
          const t = transcripts.find(t2 => t2.interview_id === a.interview_id);
          return t?.model === m;
        });
        row[m] = modelAnalysis.filter(a => a.primary_emotion === emotion).length;
      });
      return row;
    });
  }, [analysis, transcripts, models]);

  // ── Model sentiment bar data ──
  const modelSentimentData = useMemo(() => {
    return models.map(m => {
      const modelAnalysis = analysis.filter(a => {
        const t = transcripts.find(t2 => t2.interview_id === a.interview_id);
        return t?.model === m;
      });
      let pos = 0, neu = 0, neg = 0;
      modelAnalysis.forEach(a => {
        const c = a.sentiment_scores?.compound ?? a.sentiment_scores?.overall ?? 0;
        if (c >= 0.05) pos++;
        else if (c <= -0.05) neg++;
        else neu++;
      });
      return { model: m.split("/").pop() || m, Positive: pos, Neutral: neu, Negative: neg };
    });
  }, [analysis, transcripts, models]);

  // ── Selected transcript ──
  const selectedTranscript = useMemo(() => {
    if (!selectedPersona) return null;
    return transcripts.find(t => t.persona_id === selectedPersona || t.persona_name === selectedPersona);
  }, [selectedPersona, transcripts]);

  if (loading) return <LoadingSpinner />;

  const totalSentiment = sentiments.positive + sentiments.neutral + sentiments.negative || 1;
  const llmThemes = themes.filter(t => t.source === "llm");
  const ldaThemes = themes.filter(t => t.source === "lda");

  return (
    <div className="space-y-6">
      {/* ── Overview Stats ── */}
      {(() => {
        const followUpCount = transcripts.filter(t => t.follow_ups && t.follow_ups.length > 0).length;
        const totalFollowUps = transcripts.reduce((sum: number, t: any) => sum + (t.follow_ups?.length || 0), 0);
        return (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total Interviews" value={transcripts.length} sub={`across ${models.length} models`} />
            <StatCard label="Follow-up Probes" value={totalFollowUps} sub={`${followUpCount} interviews deepened`} />
            <StatCard label="Themes Identified" value={themes.length} sub={`${llmThemes.length} LLM + ${ldaThemes.length} LDA`} />
            <StatCard label="Dominant Emotion" value={emotionCounts[0]?.[0] || "—"} sub={`${emotionCounts[0]?.[1] || 0} respondents`} />
            <StatCard label="Positive Sentiment" value={`${Math.round((sentiments.positive / totalSentiment) * 100)}%`} sub={`${sentiments.positive} of ${totalSentiment}`} />
          </div>
        );
      })()}

      {/* ── Sentiment Distribution Bar ── */}
      <div>
        <SectionHeader>Overall Sentiment Distribution</SectionHeader>
        <div className="h-10 flex rounded-lg overflow-hidden border border-gray-700">
          <div className="bg-emerald-600 flex items-center justify-center text-sm font-medium transition-all"
            style={{ width: `${(sentiments.positive / totalSentiment) * 100}%` }}>
            {sentiments.positive > 0 && `${sentiments.positive} positive`}
          </div>
          <div className="bg-gray-600 flex items-center justify-center text-sm font-medium transition-all"
            style={{ width: `${(sentiments.neutral / totalSentiment) * 100}%` }}>
            {sentiments.neutral > 0 && `${sentiments.neutral} neutral`}
          </div>
          <div className="bg-red-600 flex items-center justify-center text-sm font-medium transition-all"
            style={{ width: `${(sentiments.negative / totalSentiment) * 100}%` }}>
            {sentiments.negative > 0 && `${sentiments.negative} negative`}
          </div>
        </div>
      </div>

      {/* ── Charts Row: Emotion Radar + Model Sentiment ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emotion Radar by Model */}
        <div>
          <SectionHeader>Emotion Profile by Model</SectionHeader>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="emotion" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                {models.map((m, i) => (
                  <Radar key={m} name={m.split("/").pop() || m} dataKey={m}
                    stroke={MODEL_COLORS[i % MODEL_COLORS.length]}
                    fill={MODEL_COLORS[i % MODEL_COLORS.length]}
                    fillOpacity={0.15} strokeWidth={2} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Sentiment Stacked Bar */}
        <div>
          <SectionHeader>Sentiment by Model</SectionHeader>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={modelSentimentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="model" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RBar dataKey="Positive" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <RBar dataKey="Neutral" stackId="a" fill="#6b7280" />
                <RBar dataKey="Negative" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Sentiment Heatmap ── */}
      {heatmapData.length > 0 && (
        <div>
          <SectionHeader>Sentiment Heatmap (Persona × Question)</SectionHeader>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2 text-gray-400 font-medium sticky left-0 bg-gray-900/90">Persona</th>
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">Model</th>
                  {Object.entries(QUESTION_LABELS).map(([key, label]) => (
                    <th key={key} className="text-center py-2 px-1 text-gray-400 font-medium" title={label}>
                      {key.replace("IQ", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.slice(0, 30).map((row, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                    onClick={() => setSelectedPersona(row.persona)}>
                    <td className="py-1.5 px-2 text-gray-300 font-medium sticky left-0 bg-gray-900/90 truncate max-w-[100px]">
                      {row.persona}
                    </td>
                    <td className="py-1.5 px-2 text-gray-500 text-xs truncate max-w-[80px]">
                      {(row.model as string).split("/").pop()}
                    </td>
                    {Object.keys(QUESTION_LABELS).map(q => {
                      const val = row[q] as number | null;
                      return (
                        <td key={q} className="py-1.5 px-1 text-center">
                          {val != null ? (
                            <span className="inline-block w-8 h-6 rounded text-[10px] font-mono font-bold leading-6"
                              style={{ backgroundColor: sentimentColor(val) + "33", color: sentimentColor(val) }}>
                              {val.toFixed(1)}
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
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#991b1b" }} /> Negative</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#6b7280" }} /> Neutral</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: "#166534" }} /> Positive</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Emotion Breakdown ── */}
      <div>
        <SectionHeader>Emotion Breakdown</SectionHeader>
        <div className="flex flex-wrap gap-2">
          {emotionCounts.map(([emotion, count]) => (
            <div key={emotion} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: EMOTION_COLORS[emotion] || "#6b7280" }} />
              <span className="text-sm text-gray-300 capitalize">{emotion}</span>
              <span className="text-sm text-gray-500 font-mono">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Themes ── */}
      {llmThemes.length > 0 && (
        <div>
          <SectionHeader>Emergent Themes ({llmThemes.length})</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {llmThemes.map((theme, i) => (
              <div key={i} className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-semibold text-white">{theme.theme_name}</h5>
                  <Tag color="bg-purple-900/50 text-purple-300">n={theme.frequency || 0}</Tag>
                </div>
                {theme.description && (
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">{theme.description}</p>
                )}
                {theme.supporting_quotes && theme.supporting_quotes.length > 0 && (
                  <div className="space-y-2">
                    {(theme.supporting_quotes as any[]).slice(0, 2).map((q: any, j: number) => (
                      <blockquote key={j} className="border-l-2 border-purple-700 pl-3 text-xs text-gray-400 italic">
                        &ldquo;{typeof q === "string" ? q : q.quote}&rdquo;
                        {typeof q !== "string" && q.respondent_id && (
                          <span className="text-gray-600 not-italic"> — {q.respondent_id}</span>
                        )}
                      </blockquote>
                    ))}
                  </div>
                )}
                {theme.keywords && theme.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(theme.keywords as string[]).slice(0, 6).map((kw, j) => (
                      <span key={j} className="px-2 py-0.5 rounded bg-gray-700/50 text-xs text-gray-400">{kw}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Transcript Browser ── */}
      <div>
        <SectionHeader>Transcript Browser</SectionHeader>
        <div className="flex flex-wrap gap-2 mb-4">
          {transcripts.map(t => (
            <button key={t.interview_id}
              onClick={() => setSelectedPersona(t.persona_name || t.persona_id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedPersona === (t.persona_name || t.persona_id)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}>
              {t.persona_name || t.persona_id}
            </button>
          ))}
        </div>

        {selectedTranscript && (
          <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-lg font-semibold text-white">{selectedTranscript.persona_name}</span>
              <Tag>{(selectedTranscript.model as string).split("/").pop()}</Tag>
              {selectedTranscript.demographics && (
                <>
                  <span className="text-xs text-gray-500">{selectedTranscript.demographics.age}</span>
                  <span className="text-xs text-gray-500">{selectedTranscript.demographics.income}</span>
                  <span className="text-xs text-gray-500">{selectedTranscript.demographics.work_arrangement}</span>
                </>
              )}
            </div>
            <div className="space-y-4">
              {Object.entries(QUESTION_LABELS).map(([key, label]) => {
                const response = selectedTranscript.responses?.[key];
                if (!response) return null;
                return (
                  <div key={key}>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      {key}: {label}
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{response}</p>
                  </div>
                );
              })}
              {/* Follow-up probes (multi-turn) */}
              {selectedTranscript.follow_ups && selectedTranscript.follow_ups.length > 0 && (
                <div className="mt-6 pt-4 border-t border-blue-800/40">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Follow-up Probes</span>
                    <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 text-[10px] font-medium">
                      Multi-turn
                    </span>
                  </div>
                  {(selectedTranscript.follow_ups as any[]).map((fu: any, i: number) => (
                    <div key={i} className="mb-4 pl-3 border-l-2 border-blue-700/50">
                      <div className="text-xs text-blue-300 font-medium mb-1">
                        {fu.probe_key}: {fu.question}
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{fu.response}</p>
                      <span className="text-[10px] text-gray-600 mt-1 inline-block">
                        Triggered by: {fu.trigger}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedTranscript && (
          <p className="text-sm text-gray-500 text-center py-6">Click a persona above to view their full interview transcript.</p>
        )}
      </div>
    </div>
  );
}
