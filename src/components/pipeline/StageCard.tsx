"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Bar, SectionHeader, Tag, StatCard, LoadingSpinner } from "./ui";
import { MarkdownText } from "./MarkdownText";

interface Stage {
  id: number;
  name: string;
  description: string;
}

interface StageState {
  status: "locked" | "ready" | "running" | "completed" | "error";
  progress: number;
  message: string;
  startedAt: string | null;
  completedAt: string | null;
  tokensUsed: number;
  costEstimate: number;
}

interface StageCardProps {
  stage: Stage;
  state: StageState;
  isExpanded: boolean;
  runId: string | null;
  onRun: () => void;
  onToggle: () => void;
}

// ─── Stage result renderers ─────────────────────────────────────────────────

function DiscoveryResults({ runId }: { runId: string }) {
  const [brief, setBrief] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    Promise.all([
      supabase.from("discovery_briefs").select("*").eq("run_id", runId).limit(1).single(),
      supabase.from("discovery_responses").select("*").eq("run_id", runId),
    ]).then(([briefRes, respRes]) => {
      setBrief((briefRes.data as any)?.brief);
      setResponses(respRes.data || []);
      setLoading(false);
    });
  }, [runId]);

  if (loading) return <LoadingSpinner />;
  if (!brief) return <p className="text-gray-500 text-sm">No discovery data found.</p>;

  const models = [...new Set(responses.map(r => r.model))];
  const sampleQuestions = [...new Set(responses.map(r => r.question_key))].slice(0, 3);

  return (
    <div className="space-y-2">
      <SectionHeader>Product Summary</SectionHeader>
      <p className="text-gray-300 text-sm leading-relaxed">{brief.product_summary || brief.productSummary || "AI-powered market research platform using 3-model triangulation."}</p>

      <SectionHeader>Target Segments</SectionHeader>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {(brief.target_segments || brief.targetSegments || []).map((seg: any, i: number) => (
          <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
            <div className="font-medium text-sm text-white">{typeof seg === "string" ? seg : seg.name || seg.label}</div>
            {typeof seg !== "string" && seg.description && (
              <div className="text-xs text-gray-400 mt-1">{seg.description}</div>
            )}
          </div>
        ))}
      </div>

      {(brief.key_barriers || brief.keyBarriers || []).length > 0 && (
        <>
          <SectionHeader>Key Barriers</SectionHeader>
          <ul className="space-y-1.5">
            {(brief.key_barriers || brief.keyBarriers || []).map((b: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-red-400 mt-0.5">&#x2022;</span>{b}
              </li>
            ))}
          </ul>
        </>
      )}

      {(brief.positioning_strategy || brief.positioningStrategy) && (
        <>
          <SectionHeader>Positioning Strategy</SectionHeader>
          <p className="text-gray-300 text-sm leading-relaxed bg-gray-800/40 rounded-lg p-3 border-l-2 border-blue-500">
            {brief.positioning_strategy || brief.positioningStrategy}
          </p>
        </>
      )}

      {responses.length > 0 && (
        <>
          <SectionHeader>Model Responses (Sample)</SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Question</th>
                  {models.map(m => (
                    <th key={m} className="text-left py-2 px-3 text-gray-400 font-medium">{m.split("/").pop()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleQuestions.map(qk => {
                  const qResponses = responses.filter(r => r.question_key === qk);
                  return (
                    <tr key={qk} className="border-b border-gray-800/50">
                      <td className="py-2 px-3 text-gray-300 font-medium">{qResponses[0]?.question_label || qk}</td>
                      {models.map(m => {
                        const r = qResponses.find(r => r.model === m);
                        return (
                          <td key={m} className="py-2 px-3 text-gray-400 text-xs max-w-xs">
                            {r ? <MarkdownText text={r.response.length > 200 ? r.response.slice(0, 200) + "..." : r.response} /> : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="grid grid-cols-3 gap-3 mt-4">
        <StatCard label="Models Used" value={models.length} />
        <StatCard label="Questions Asked" value={[...new Set(responses.map(r => r.question_key))].length} />
        <StatCard label="Total Responses" value={responses.length} />
      </div>
    </div>
  );
}

function InterviewResults({ runId }: { runId: string }) {
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any[]>([]);
  const [themes, setThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    Promise.all([
      supabase.from("interview_transcripts").select("id, model, persona_name, demographics").eq("run_id", runId),
      supabase.from("interview_analysis").select("*").eq("run_id", runId),
      supabase.from("interview_themes").select("*").eq("run_id", runId).order("frequency", { ascending: false }),
    ]).then(([tRes, aRes, thRes]) => {
      setTranscripts(tRes.data || []);
      setAnalysis(aRes.data || []);
      setThemes(thRes.data || []);
      setLoading(false);
    });
  }, [runId]);

  if (loading) return <LoadingSpinner />;

  const models = [...new Set(transcripts.map(t => t.model))];
  const sentiments = { positive: 0, neutral: 0, negative: 0 };
  const emotions: Record<string, number> = {};

  analysis.forEach(a => {
    const scores = a.sentiment_scores || {};
    if (scores.compound >= 0.05) sentiments.positive++;
    else if (scores.compound <= -0.05) sentiments.negative++;
    else sentiments.neutral++;

    if (a.primary_emotion) {
      emotions[a.primary_emotion] = (emotions[a.primary_emotion] || 0) + 1;
    }
  });

  const totalSentiment = sentiments.positive + sentiments.neutral + sentiments.negative || 1;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Interviews" value={transcripts.length} sub={`across ${models.length} models`} />
        <StatCard label="Themes Identified" value={themes.length} sub="LDA + LLM extraction" />
        <StatCard label="Analyses Run" value={analysis.length} sub="sentiment + emotion" />
      </div>

      <SectionHeader>Sentiment Distribution</SectionHeader>
      <div className="h-8 flex rounded-lg overflow-hidden border border-gray-700">
        <div className="bg-emerald-600 flex items-center justify-center text-xs font-medium transition-all" style={{ width: `${(sentiments.positive / totalSentiment) * 100}%` }}>
          {sentiments.positive > 0 && `${sentiments.positive} pos`}
        </div>
        <div className="bg-gray-600 flex items-center justify-center text-xs font-medium transition-all" style={{ width: `${(sentiments.neutral / totalSentiment) * 100}%` }}>
          {sentiments.neutral > 0 && `${sentiments.neutral} neu`}
        </div>
        <div className="bg-red-600 flex items-center justify-center text-xs font-medium transition-all" style={{ width: `${(sentiments.negative / totalSentiment) * 100}%` }}>
          {sentiments.negative > 0 && `${sentiments.negative} neg`}
        </div>
      </div>

      <SectionHeader>Top Themes</SectionHeader>
      <div className="flex flex-wrap gap-2">
        {themes.slice(0, 12).map((t, i) => (
          <Tag key={i} color={t.source === "llm" ? "bg-purple-900/50 text-purple-300" : "bg-blue-900/50 text-blue-300"}>
            {t.theme_name} ({t.frequency || 0})
          </Tag>
        ))}
      </div>

      {Object.keys(emotions).length > 0 && (
        <>
          <SectionHeader>Emotion Breakdown</SectionHeader>
          <div className="space-y-2">
            {Object.entries(emotions)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([emotion, count]) => (
                <Bar key={emotion} label={emotion} value={count} max={Math.max(...Object.values(emotions))} color="bg-violet-500" />
              ))}
          </div>
        </>
      )}

      <SectionHeader>Model Breakdown</SectionHeader>
      <div className="space-y-2">
        {models.map(m => (
          <Bar key={m} label={m.split("/").pop() || m} value={transcripts.filter(t => t.model === m).length} max={transcripts.length} color="bg-cyan-500" />
        ))}
      </div>
    </div>
  );
}

function SurveyDesignResults({ runId }: { runId: string }) {
  const [designs, setDesigns] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <LoadingSpinner />;

  const models = [...new Set(designs.map(d => d.model))];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Model Variants" value={designs.length} />
        <StatCard label="Avg Questions" value={designs.length > 0 ? Math.round(designs.reduce((s, d) => s + (d.total_questions || 0), 0) / designs.length) : 0} />
        <StatCard label="Est. Duration" value={`${designs.length > 0 ? Math.round(designs.reduce((s, d) => s + (d.estimated_duration_minutes || 0), 0) / designs.length) : 0}m`} />
      </div>

      {coverage.length > 0 && (
        <>
          <SectionHeader>Section Coverage</SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Section</th>
                  {models.map(m => (
                    <th key={m} className="text-center py-2 px-3 text-gray-400 font-medium">{m.split("/").pop()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coverage.map((c, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-2 px-3 text-gray-300 font-medium">{c.section_label}</td>
                    {models.map(m => {
                      const included = (c.models_including || []).includes(m);
                      const count = c.question_counts?.[m] || c.question_counts?.[m.split("/").pop()] || 0;
                      return (
                        <td key={m} className="py-2 px-3 text-center">
                          {included ? (
                            <span className="text-emerald-400 font-mono text-xs">{count || "Y"}</span>
                          ) : (
                            <span className="text-gray-600">--</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionHeader>Survey Structure by Model</SectionHeader>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {designs.map((d, i) => {
          const design = d.design || {};
          const sections = design.sections || design.survey_sections || [];
          return (
            <div key={i} className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
              <div className="font-medium text-sm text-white mb-2">{d.model.split("/").pop()}</div>
              <div className="text-xs text-gray-400 space-y-1">
                <div>Questions: <span className="text-white font-mono">{d.total_questions || "—"}</span></div>
                <div>Duration: <span className="text-white font-mono">{d.estimated_duration_minutes || "—"}m</span></div>
                {Array.isArray(sections) && sections.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {sections.slice(0, 5).map((s: any, j: number) => (
                      <div key={j} className="text-gray-500">{s.title || s.name || s.section_title || `Section ${j + 1}`}</div>
                    ))}
                    {sections.length > 5 && <div className="text-gray-600">+{sections.length - 5} more</div>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SurveyResponseResults({ runId }: { runId: string }) {
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.from("survey_responses").select("id, model, segment_id, segment_name, respondent_id").eq("run_id", runId)
      .then(({ data }) => {
        setResponses(data || []);
        setLoading(false);
      });
  }, [runId]);

  if (loading) return <LoadingSpinner />;

  const segments: Record<string, number> = {};
  const modelCounts: Record<string, number> = {};
  responses.forEach(r => {
    segments[r.segment_name] = (segments[r.segment_name] || 0) + 1;
    const shortModel = r.model.split("/").pop() || r.model;
    modelCounts[shortModel] = (modelCounts[shortModel] || 0) + 1;
  });

  const maxSegment = Math.max(...Object.values(segments), 1);
  const maxModel = Math.max(...Object.values(modelCounts), 1);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Respondents" value={responses.length} />
        <StatCard label="Segments" value={Object.keys(segments).length} />
        <StatCard label="Models Used" value={Object.keys(modelCounts).length} />
      </div>

      <SectionHeader>Respondents by Segment</SectionHeader>
      <div className="space-y-2">
        {Object.entries(segments)
          .sort(([, a], [, b]) => b - a)
          .map(([seg, count]) => (
            <Bar key={seg} label={seg} value={count} max={maxSegment} color="bg-emerald-500" />
          ))}
      </div>

      <SectionHeader>Respondents by Model</SectionHeader>
      <div className="space-y-2">
        {Object.entries(modelCounts).map(([model, count]) => (
          <Bar key={model} label={model} value={count} max={maxModel} color="bg-cyan-500" />
        ))}
      </div>

      <SectionHeader>Sample Respondents</SectionHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Respondent</th>
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Model</th>
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Segment</th>
            </tr>
          </thead>
          <tbody>
            {responses.slice(0, 8).map((r, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                <td className="py-2 px-3 text-gray-300 font-mono text-xs">{r.respondent_id}</td>
                <td className="py-2 px-3 text-gray-400 text-xs">{r.model.split("/").pop()}</td>
                <td className="py-2 px-3"><Tag>{r.segment_name}</Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
        {responses.length > 8 && (
          <p className="text-xs text-gray-600 mt-2 text-center">Showing 8 of {responses.length} respondents</p>
        )}
      </div>
    </div>
  );
}

function AnalysisResults({ runId }: { runId: string }) {
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

  if (loading) return <LoadingSpinner />;

  const byType: Record<string, any[]> = {};
  results.forEach(r => {
    byType[r.analysis_type] = byType[r.analysis_type] || [];
    byType[r.analysis_type].push(r);
  });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Analysis Types" value={Object.keys(byType).length} />
        <StatCard label="Total Results" value={results.length} />
        <StatCard label="Groupings" value={[...new Set(results.map(r => r.group_by).filter(Boolean))].length} />
      </div>

      {Object.entries(byType).map(([type, items]) => (
        <div key={type}>
          <SectionHeader>{type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SectionHeader>
          {items.map((item, i) => {
            const data = item.results || {};
            if (type === "purchase_interest" || type === "concept_appeal") {
              const entries = Object.entries(data).filter(([k]) => k !== "_meta");
              const maxVal = Math.max(...entries.map(([, v]) => Number(v) || 0), 1);
              return (
                <div key={i} className="space-y-2 mb-4">
                  {item.group_by && <p className="text-xs text-gray-500 mb-2">Grouped by: {item.group_by}</p>}
                  {entries.slice(0, 10).map(([label, val]) => (
                    <Bar key={label} label={label} value={Number(val) || 0} max={maxVal}
                      color={type === "purchase_interest" ? "bg-emerald-500" : "bg-blue-500"}
                      suffix={type === "purchase_interest" ? "%" : ""} />
                  ))}
                </div>
              );
            }

            if (type === "cross_tabulation") {
              const segMeans = data.segment_means as Record<string, Record<string, number>> || {};
              const modMeans = data.model_means as Record<string, Record<string, number>> || {};
              const keyVars = ["Q1", "Q2", "Q7", "Q0b", "Q5_cost", "Q5_hoa", "Q5_permit"];
              return (
                <div key={i} className="space-y-4 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Respondents" value={data.total_respondents || 0} />
                    <StatCard label="Attention Pass" value={`${((data.attention_check_pass_rate || 0) * 100).toFixed(0)}%`} />
                  </div>
                  <SectionHeader>Segment Comparison (Key Variables)</SectionHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="text-left py-2 pr-2">Variable</th>
                          {Object.keys(segMeans).map(seg => (
                            <th key={seg} className="text-center py-2 px-2">{seg}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {keyVars.map(v => (
                          <tr key={v} className="border-b border-gray-800">
                            <td className="py-1.5 pr-2 text-gray-300 font-mono">{v}</td>
                            {Object.entries(segMeans).map(([seg, vals]) => {
                              const val = vals[v] ?? 0;
                              const bg = val >= 4 ? "text-emerald-400" : val >= 3 ? "text-yellow-400" : "text-red-400";
                              return <td key={seg} className={`text-center py-1.5 px-2 font-bold ${bg}`}>{val.toFixed(2)}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <SectionHeader>Model Means</SectionHeader>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(modMeans).map(([model, vals]) => (
                      <div key={model} className="bg-gray-800/40 border border-gray-700 rounded-lg p-3">
                        <p className="text-sm font-medium text-white mb-2">{model}</p>
                        <div className="space-y-1">
                          {keyVars.map(v => (
                            <div key={v} className="flex justify-between text-xs">
                              <span className="text-gray-400 font-mono">{v}</span>
                              <span className="text-white font-bold">{(vals[v] ?? 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (type === "model_agreement" || type === "model_comparison") {
              return (
                <div key={i} className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 mb-3">
                  {item.group_by && <p className="text-xs text-gray-500 mb-2">{item.group_by}</p>}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(data).slice(0, 9).map(([k, v]) => (
                      <div key={k} className="text-center">
                        <div className="text-lg font-bold text-white">{typeof v === "number" ? (v > 1 ? v.toFixed(1) : (v * 100).toFixed(0) + "%") : String(v)}</div>
                        <div className="text-xs text-gray-400">{k.replace(/_/g, " ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // Generic fallback: render as key-value
            return (
              <div key={i} className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 mb-3">
                {item.group_by && <p className="text-xs text-gray-500 mb-2">{item.group_by}</p>}
                <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(data, null, 2).slice(0, 500)}
                </pre>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ValidationResults({ runId }: { runId: string }) {
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

  const gradeColors: Record<string, string> = {
    A: "text-emerald-400 border-emerald-500",
    B: "text-blue-400 border-blue-500",
    C: "text-yellow-400 border-yellow-500",
    D: "text-orange-400 border-orange-500",
    F: "text-red-400 border-red-500",
  };
  const gradeColor = gradeColors[report.grade?.[0]] || "text-gray-400 border-gray-500";

  // Quality score distribution
  const scoreBuckets: Record<string, number> = { "90-100": 0, "70-89": 0, "50-69": 0, "0-49": 0 };
  scores.forEach(s => {
    const q = s.quality_score;
    if (q >= 90) scoreBuckets["90-100"]++;
    else if (q >= 70) scoreBuckets["70-89"]++;
    else if (q >= 50) scoreBuckets["50-69"]++;
    else scoreBuckets["0-49"]++;
  });
  const maxBucket = Math.max(...Object.values(scoreBuckets), 1);

  const attentionPass = scores.filter(s => s.attention_pass).length;
  const attentionTotal = scores.length || 1;

  // Bias detection
  const biasItems = report.bias_detection || {};
  const biasEntries = Array.isArray(biasItems) ? biasItems : Object.entries(biasItems);

  // Confidence intervals
  const ciItems = report.confidence_intervals || {};
  const ciEntries = Array.isArray(ciItems) ? ciItems : Object.entries(ciItems);

  return (
    <div className="space-y-2">
      {/* Grade hero */}
      <div className="flex items-center gap-6 mb-4">
        <div className={`w-24 h-24 rounded-xl border-2 ${gradeColor} flex items-center justify-center bg-gray-900`}>
          <span className={`text-5xl font-black ${gradeColor.split(" ")[0]}`}>{report.grade}</span>
        </div>
        <div>
          <div className="text-lg font-semibold text-white">Quality Grade</div>
          <div className="text-sm text-gray-400 mt-1">
            {report.issues_found} issue{report.issues_found !== 1 ? "s" : ""} found across {report.total_checks} checks
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-2 w-32 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${((report.total_checks - report.issues_found) / report.total_checks) * 100}%` }} />
            </div>
            <span className="text-xs text-gray-400">{Math.round(((report.total_checks - report.issues_found) / report.total_checks) * 100)}% pass rate</span>
          </div>
        </div>
      </div>

      <SectionHeader>Quality Score Distribution</SectionHeader>
      <div className="space-y-2">
        <Bar label="Excellent (90-100)" value={scoreBuckets["90-100"]} max={maxBucket} color="bg-emerald-500" />
        <Bar label="Good (70-89)" value={scoreBuckets["70-89"]} max={maxBucket} color="bg-blue-500" />
        <Bar label="Fair (50-69)" value={scoreBuckets["50-69"]} max={maxBucket} color="bg-yellow-500" />
        <Bar label="Poor (0-49)" value={scoreBuckets["0-49"]} max={maxBucket} color="bg-red-500" />
      </div>

      <SectionHeader>Attention Check</SectionHeader>
      <div className="flex items-center gap-4">
        <div className="h-6 flex-1 flex rounded-lg overflow-hidden border border-gray-700">
          <div className="bg-emerald-600 flex items-center justify-center text-xs font-medium" style={{ width: `${(attentionPass / attentionTotal) * 100}%` }}>
            {attentionPass} pass
          </div>
          <div className="bg-red-800 flex items-center justify-center text-xs font-medium" style={{ width: `${((attentionTotal - attentionPass) / attentionTotal) * 100}%` }}>
            {attentionTotal - attentionPass > 0 && `${attentionTotal - attentionPass} fail`}
          </div>
        </div>
        <span className="text-sm text-gray-400 font-mono">{Math.round((attentionPass / attentionTotal) * 100)}%</span>
      </div>

      {biasEntries.length > 0 && (
        <>
          <SectionHeader>Bias Detection</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(Array.isArray(biasItems) ? biasItems : Object.entries(biasItems)).slice(0, 6).map((item: any, i: number) => {
              const [key, val] = Array.isArray(item) ? item : [item.test || item.name || `Check ${i + 1}`, item];
              const passed = typeof val === "object" ? val.passed ?? val.result === "pass" : !!val;
              return (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${passed ? "border-emerald-800 bg-emerald-950/20" : "border-red-800 bg-red-950/20"}`}>
                  <span className={`text-sm ${passed ? "text-emerald-400" : "text-red-400"}`}>{passed ? "\u2713" : "\u2717"}</span>
                  <span className="text-sm text-gray-300">{typeof key === "string" ? key.replace(/_/g, " ") : String(key)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {ciEntries.length > 0 && (
        <>
          <SectionHeader>Confidence Intervals</SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Metric</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium">Lower</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium">Point Est.</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium">Upper</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(ciItems) ? ciItems : Object.entries(ciItems)).slice(0, 8).map((item: any, i: number) => {
                  const [key, val] = Array.isArray(item) && typeof item[0] === "string" ? item : [item.metric || `Metric ${i + 1}`, item];
                  const ci = typeof val === "object" ? val : {};
                  return (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-2 px-3 text-gray-300">{typeof key === "string" ? key.replace(/_/g, " ") : String(key)}</td>
                      <td className="py-2 px-3 text-center font-mono text-xs text-gray-400">{ci.lower?.toFixed?.(2) ?? ci.low?.toFixed?.(2) ?? "—"}</td>
                      <td className="py-2 px-3 text-center font-mono text-xs text-white font-bold">{ci.point?.toFixed?.(2) ?? ci.estimate?.toFixed?.(2) ?? ci.mean?.toFixed?.(2) ?? "—"}</td>
                      <td className="py-2 px-3 text-center font-mono text-xs text-gray-400">{ci.upper?.toFixed?.(2) ?? ci.high?.toFixed?.(2) ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionHeader>Recommendation</SectionHeader>
      <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 border-l-2 border-l-blue-500">
        <p className="text-gray-300 text-sm leading-relaxed">{report.recommendation}</p>
      </div>
    </div>
  );
}

// All 6 stages have dedicated Recharts detail views
const STAGES_WITH_DETAIL_VIEW = new Set([1, 2, 3, 4, 5, 6]);

// ─── Main StageCard ─────────────────────────────────────────────────────────

export function StageCard({ stage, state, isExpanded, runId, onRun, onToggle }: StageCardProps) {
  const { status, progress, message, startedAt, completedAt, tokensUsed, costEstimate } = state;

  const borderColor: Record<string, string> = {
    locked: "border-gray-800",
    ready: "border-blue-700 hover:border-blue-500",
    running: "border-blue-500",
    completed: "border-green-700 hover:border-green-600",
    error: "border-red-700",
  };

  const bgColor: Record<string, string> = {
    locked: "bg-gray-900/50",
    ready: "bg-gray-900",
    running: "bg-blue-950/30",
    completed: "bg-green-950/20",
    error: "bg-red-950/20",
  };

  const statusIcon: Record<string, string> = {
    locked: "\uD83D\uDD12",
    ready: "\u25B6\uFE0F",
    running: "\u23F3",
    completed: "\u2705",
    error: "\u274C",
  };

  const resultComponents: Record<number, (props: { runId: string }) => React.JSX.Element> = {
    1: DiscoveryResults,
    2: InterviewResults,
    3: SurveyDesignResults,
    4: SurveyResponseResults,
    5: AnalysisResults,
    6: ValidationResults,
  };

  const ResultComponent = resultComponents[stage.id];

  return (
    <div
      className={`rounded-lg border ${borderColor[status]} ${bgColor[status]} transition-all ${
        status === "locked" ? "opacity-50" : ""
      } ${status === "running" ? "animate-pulse" : ""}`}
    >
      <div
        className={`p-6 flex items-center justify-between ${
          status === "completed" ? "cursor-pointer" : ""
        }`}
        onClick={status === "completed" ? onToggle : undefined}
      >
        <div className="flex items-center gap-4">
          <span className="text-2xl">{statusIcon[status]}</span>
          <div>
            <h3 className="text-lg font-semibold">
              Stage {stage.id}: {stage.name}
            </h3>
            <p className="text-gray-400 text-sm">{stage.description}</p>
            {status === "running" && message && (
              <p className="text-blue-400 text-xs mt-1">{message}</p>
            )}
            {status === "error" && message && (
              <p className="text-red-400 text-xs mt-1">{message}</p>
            )}
            {status === "completed" && startedAt && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500 font-mono">
                  {(() => {
                    const start = new Date(startedAt).getTime();
                    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
                    const secs = Math.round((end - start) / 1000);
                    if (secs < 60) return secs + "s";
                    const m = Math.floor(secs / 60);
                    return m + "m " + (secs % 60) + "s";
                  })()}
                </span>
                {tokensUsed > 0 && (
                  <span className="text-xs text-gray-600">{tokensUsed.toLocaleString()} tokens</span>
                )}
                {costEstimate > 0 && (
                  <span className="text-xs text-emerald-600 font-mono">${costEstimate.toFixed(4)}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status === "running" && (
            <div className="w-32">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">{progress}%</p>
            </div>
          )}

          {status === "ready" && (
            <button
              onClick={(e) => { e.stopPropagation(); onRun(); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              Run Stage
            </button>
          )}

          {status === "completed" && STAGES_WITH_DETAIL_VIEW.has(stage.id) && runId && (
            <Link
              href={`/stage/${stage.id}?runId=${runId}`}
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-1.5 bg-blue-900/50 hover:bg-blue-800/50 border border-blue-700/50 rounded-lg text-xs text-blue-300 font-medium transition-colors"
            >
              View Details &rarr;
            </Link>
          )}

          {status === "completed" && (
            <span className={`text-gray-500 text-sm transition-transform ${isExpanded ? "rotate-180" : ""}`}>
              &#x25BC;
            </span>
          )}
        </div>
      </div>

      {isExpanded && status === "completed" && runId && ResultComponent && (
        <div className="border-t border-gray-800 p-6">
          <ResultComponent runId={runId} />
        </div>
      )}
    </div>
  );
}
