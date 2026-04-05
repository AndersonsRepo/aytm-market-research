"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  BENCHMARK_PURCHASE_INTEREST,
  BENCHMARK_PURCHASE_LIKELIHOOD,
  BENCHMARK_USE_CASE,
  BENCHMARK_GREATEST_BARRIER,
  BENCHMARK_BEST_CONCEPT,
} from "@/lib/pipeline/benchmark";

// ── Types ──

interface RunInfo { id: string; mode: string; status: string; created_at: string }

// ── Helpers ──

function computeDist(rows: any[], key: string): Record<string, { count: number; pct: number }> {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const val = r.responses?.[key];
    if (val == null || val === "") continue;
    const s = String(val);
    counts[s] = (counts[s] || 0) + 1;
    total++;
  }
  const result: Record<string, { count: number; pct: number }> = {};
  for (const [k, c] of Object.entries(counts)) {
    result[k] = { count: c, pct: total > 0 ? Math.round((c / total) * 1000) / 10 : 0 };
  }
  return result;
}

function computeMean(rows: any[], key: string): number {
  const vals = rows.map(r => Number(r.responses?.[key])).filter(v => !isNaN(v));
  return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0;
}

// ── Badge Component ──

function AlignBadge({ delta, threshold = 5 }: { delta: number; threshold?: number }) {
  const abs = Math.abs(delta);
  if (abs <= threshold) {
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/40 text-emerald-300">ALIGNED ({delta > 0 ? "+" : ""}{delta.toFixed(1)}pp)</span>;
  }
  if (abs <= threshold * 2) {
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-900/40 text-yellow-300">CLOSE ({delta > 0 ? "+" : ""}{delta.toFixed(1)}pp)</span>;
  }
  return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-900/40 text-red-300">DIVERGENT ({delta > 0 ? "+" : ""}{delta.toFixed(1)}pp)</span>;
}

function MeanBadge({ synthetic, real, threshold = 0.3 }: { synthetic: number; real: number; threshold?: number }) {
  const delta = synthetic - real;
  const abs = Math.abs(delta);
  const color = abs <= threshold ? "emerald" : abs <= threshold * 2 ? "yellow" : "red";
  const label = abs <= threshold ? "ALIGNED" : abs <= threshold * 2 ? "CLOSE" : "DIVERGENT";
  return (
    <div className="flex items-center gap-3">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-400 font-mono">{synthetic.toFixed(2)}</div>
        <div className="text-[10px] text-gray-500">Synthetic</div>
      </div>
      <div className="text-gray-600">vs</div>
      <div className="text-center">
        <div className="text-2xl font-bold text-emerald-400 font-mono">{real.toFixed(2)}</div>
        <div className="text-[10px] text-gray-500">Real (N=600)</div>
      </div>
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold bg-${color}-900/40 text-${color}-300`}>
        {label} ({"\u0394"}{delta > 0 ? "+" : ""}{delta.toFixed(2)})
      </span>
    </div>
  );
}

// ── Benchmark Card ──

interface BenchmarkCardProps {
  title: string;
  questionLabel: string;
  realData: Record<string, number>; // label → pct
  syntheticData: Record<string, number>; // label → pct
  insight?: string;
  topRealLabel?: string;
  topSynLabel?: string;
}

function BenchmarkCard({ title, questionLabel, realData, syntheticData, insight, topRealLabel, topSynLabel }: BenchmarkCardProps) {
  // Merge all labels
  const allLabels = [...new Set([...Object.keys(realData), ...Object.keys(syntheticData)])];
  // Sort by real data descending
  allLabels.sort((a, b) => (realData[b] || 0) - (realData[a] || 0));

  const chartData = allLabels.map(label => ({
    name: label.length > 30 ? label.slice(0, 28) + "\u2026" : label,
    Real: realData[label] || 0,
    Synthetic: syntheticData[label] || 0,
  }));

  // Compute max absolute delta for top items
  const topDelta = allLabels.length > 0
    ? Math.max(...allLabels.map(l => Math.abs((syntheticData[l] || 0) - (realData[l] || 0))))
    : 0;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-xs text-gray-500">{questionLabel}</p>
        </div>
        <AlignBadge delta={topDelta} />
      </div>

      <div className="bg-gray-800/40 rounded-lg p-4 mb-4">
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 32)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 160 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} unit="%" />
            <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} width={155} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
              formatter={(value) => [`${Number(value).toFixed(1)}%`]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Real" fill="#22c55e" radius={[0, 3, 3, 0]} name="Real (N=600)" />
            <Bar dataKey="Synthetic" fill="#3b82f6" radius={[0, 3, 3, 0]} name="Synthetic (N=90)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rank comparison */}
      {topRealLabel && topSynLabel && (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-gray-500">#1 Rank:</span>
          <span className="text-xs text-emerald-400 font-medium">Real: {topRealLabel}</span>
          <span className="text-gray-700">|</span>
          <span className={`text-xs font-medium ${topRealLabel === topSynLabel ? "text-emerald-400" : "text-amber-400"}`}>
            Synthetic: {topSynLabel}
          </span>
          {topRealLabel === topSynLabel && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-900/40 text-emerald-300">RANK MATCH</span>
          )}
        </div>
      )}

      {insight && (
        <p className="text-xs text-gray-400 italic border-l-2 border-blue-700/50 pl-3">{insight}</p>
      )}
    </div>
  );
}

// ── Main Page ──

export default function BenchmarkPage() {
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function load() {
      try {
        const { data: run } = await supabase.from("pipeline_runs")
          .select("id, mode, status, created_at")
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!run) { setLoading(false); return; }
        const runData = run as unknown as RunInfo;
        setRunInfo(runData);

        const { data: surveyData } = await supabase.from("survey_responses")
          .select("responses")
          .eq("run_id", runData.id);

        if (surveyData) setResponses(surveyData);
      } catch {
        // No data available
      }
      setLoading(false);
    }

    load();
  }, []);

  // Compute synthetic distributions
  const synQ1Dist = useMemo(() => {
    const d = computeDist(responses, "Q1");
    const result: Record<string, number> = {};
    for (const k of ["1", "2", "3", "4", "5"]) {
      result[BENCHMARK_PURCHASE_INTEREST.distribution[Number(k) as 1|2|3|4|5]?.label || k] = d[k]?.pct || 0;
    }
    return result;
  }, [responses]);

  const realQ1Dist = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [, v] of Object.entries(BENCHMARK_PURCHASE_INTEREST.distribution)) {
      result[v.label] = v.pct;
    }
    return result;
  }, []);

  const synQ2Dist = useMemo(() => {
    const d = computeDist(responses, "Q2");
    const result: Record<string, number> = {};
    for (const k of ["1", "2", "3", "4", "5"]) {
      result[BENCHMARK_PURCHASE_LIKELIHOOD.distribution[Number(k) as 1|2|3|4|5]?.label || k] = d[k]?.pct || 0;
    }
    return result;
  }, [responses]);

  const realQ2Dist = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [, v] of Object.entries(BENCHMARK_PURCHASE_LIKELIHOOD.distribution)) {
      result[v.label] = v.pct;
    }
    return result;
  }, []);

  const synQ3Dist = useMemo(() => {
    const d = computeDist(responses, "Q3");
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(d)) result[k] = v.pct;
    return result;
  }, [responses]);

  const realQ3Dist = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(BENCHMARK_USE_CASE.distribution)) result[k] = v.pct;
    return result;
  }, []);

  const synQ6Dist = useMemo(() => {
    const d = computeDist(responses, "Q6");
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(d)) result[k] = v.pct;
    return result;
  }, []);

  const realQ6Dist = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(BENCHMARK_GREATEST_BARRIER.distribution)) result[k] = v.pct;
    return result;
  }, []);

  const synQ14Dist = useMemo(() => {
    const d = computeDist(responses, "Q14");
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(d)) result[k] = v.pct;
    return result;
  }, []);

  const realQ14Dist = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(BENCHMARK_BEST_CONCEPT.distribution)) result[k] = v.pct;
    return result;
  }, []);

  const synQ1Mean = useMemo(() => computeMean(responses, "Q1"), [responses]);
  const synQ2Mean = useMemo(() => computeMean(responses, "Q2"), [responses]);

  // Scorecard
  const scorecard = useMemo(() => {
    if (responses.length === 0) return null;

    // Q3 rank check
    const q3Dist = computeDist(responses, "Q3");
    const q3Sorted = Object.entries(q3Dist).sort((a, b) => b[1].pct - a[1].pct);
    const storageFirst = q3Sorted[0]?.[0]?.toLowerCase().includes("storage");

    // Q6 cost check
    const q6Dist = computeDist(responses, "Q6");
    const costPct = q6Dist["The total cost (~$23,000)"]?.pct || 0;

    // Q14 none check
    const q14Dist = computeDist(responses, "Q14");
    const nonePct = q14Dist["None of the above"]?.pct || 0;

    return {
      q1Mean: synQ1Mean,
      q1Pass: Math.abs(synQ1Mean - 2.34) <= 0.3,
      q2Mean: synQ2Mean,
      q2Pass: Math.abs(synQ2Mean - 2.05) <= 0.3,
      storageFirst,
      topUseCase: q3Sorted[0]?.[0] || "—",
      costPct,
      costPass: costPct >= 50 && costPct <= 70,
      nonePct,
      nonePass: nonePct >= 18 && nonePct <= 30,
    };
  }, [responses, synQ1Mean, synQ2Mean]);

  const passCount = scorecard
    ? [scorecard.q1Pass, scorecard.q2Pass, scorecard.storageFirst, scorecard.costPass, scorecard.nonePass].filter(Boolean).length
    : 0;

  // Rank helpers
  const topRealQ3 = Object.entries(realQ3Dist).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topSynQ3 = Object.entries(synQ3Dist).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topRealQ6 = Object.entries(realQ6Dist).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topSynQ6 = Object.entries(synQ6Dist).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topRealQ14 = Object.entries(realQ14Dist).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topSynQ14 = Object.entries(synQ14Dist).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4 inline-block">
            &larr; Back to Pipeline
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">Benchmark Validation</h1>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-900/50 text-blue-300 border border-blue-800">
              Real vs Synthetic
            </span>
          </div>
          <p className="text-gray-400 text-lg">
            Side-by-side comparison of synthetic pipeline output against the real aytm survey (N=600 US homeowners).
          </p>
          {runInfo && (
            <p className="text-xs text-gray-600 mt-2 font-mono">
              Run: {runInfo.id.slice(0, 8)} ({runInfo.mode}) &middot; {new Date(runInfo.created_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && responses.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-4">No pipeline run data found.</p>
            <p className="text-gray-600 text-sm">Run a demo or live pipeline first, then return here to see benchmark comparisons.</p>
            <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm mt-4 inline-block">
              Go to Pipeline &rarr;
            </Link>
          </div>
        )}

        {!loading && responses.length > 0 && (
          <>
            {/* Scorecard */}
            {scorecard && (
              <div className="bg-gradient-to-r from-blue-950/40 to-emerald-950/40 border border-blue-800/40 rounded-xl p-5 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Benchmark Scorecard</h2>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${passCount >= 4 ? "text-emerald-400" : passCount >= 3 ? "text-yellow-400" : "text-red-400"}`}>
                      {passCount}/5
                    </span>
                    <span className="text-xs text-gray-400">metrics pass</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className={`rounded-lg p-3 border ${scorecard.q1Pass ? "bg-emerald-950/30 border-emerald-800/50" : "bg-red-950/30 border-red-800/50"}`}>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Purchase Interest Mean</div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-bold font-mono ${scorecard.q1Pass ? "text-emerald-400" : "text-red-400"}`}>{scorecard.q1Mean.toFixed(2)}</span>
                      <span className="text-xs text-gray-500">target: 2.34</span>
                    </div>
                    <div className={`text-[10px] mt-1 ${scorecard.q1Pass ? "text-emerald-400" : "text-red-400"}`}>{scorecard.q1Pass ? "PASS" : "FAIL"}</div>
                  </div>

                  <div className={`rounded-lg p-3 border ${scorecard.q2Pass ? "bg-emerald-950/30 border-emerald-800/50" : "bg-red-950/30 border-red-800/50"}`}>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Purchase Likelihood Mean</div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-bold font-mono ${scorecard.q2Pass ? "text-emerald-400" : "text-red-400"}`}>{scorecard.q2Mean.toFixed(2)}</span>
                      <span className="text-xs text-gray-500">target: 2.05</span>
                    </div>
                    <div className={`text-[10px] mt-1 ${scorecard.q2Pass ? "text-emerald-400" : "text-red-400"}`}>{scorecard.q2Pass ? "PASS" : "FAIL"}</div>
                  </div>

                  <div className={`rounded-lg p-3 border ${scorecard.storageFirst ? "bg-emerald-950/30 border-emerald-800/50" : "bg-red-950/30 border-red-800/50"}`}>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Storage Ranked #1</div>
                    <div className="text-sm font-medium text-white truncate">{scorecard.topUseCase.length > 20 ? scorecard.topUseCase.slice(0, 18) + "\u2026" : scorecard.topUseCase}</div>
                    <div className={`text-[10px] mt-1 ${scorecard.storageFirst ? "text-emerald-400" : "text-red-400"}`}>{scorecard.storageFirst ? "PASS" : "FAIL"}</div>
                  </div>

                  <div className={`rounded-lg p-3 border ${scorecard.costPass ? "bg-emerald-950/30 border-emerald-800/50" : "bg-red-950/30 border-red-800/50"}`}>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Cost Barrier %</div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-bold font-mono ${scorecard.costPass ? "text-emerald-400" : "text-red-400"}`}>{scorecard.costPct.toFixed(1)}%</span>
                      <span className="text-xs text-gray-500">target: 55-65%</span>
                    </div>
                    <div className={`text-[10px] mt-1 ${scorecard.costPass ? "text-emerald-400" : "text-red-400"}`}>{scorecard.costPass ? "PASS" : "FAIL"}</div>
                  </div>

                  <div className={`rounded-lg p-3 border ${scorecard.nonePass ? "bg-emerald-950/30 border-emerald-800/50" : "bg-red-950/30 border-red-800/50"}`}>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">&ldquo;None&rdquo; Concept %</div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-bold font-mono ${scorecard.nonePass ? "text-emerald-400" : "text-red-400"}`}>{scorecard.nonePct.toFixed(1)}%</span>
                      <span className="text-xs text-gray-500">target: 20-28%</span>
                    </div>
                    <div className={`text-[10px] mt-1 ${scorecard.nonePass ? "text-emerald-400" : "text-red-400"}`}>{scorecard.nonePass ? "PASS" : "FAIL"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Benchmark 1: Purchase Interest */}
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Benchmark 1 of 5</h2>
            <BenchmarkCard
              title="Purchase Interest at $23K"
              questionLabel="Real Q6 / Our Q1 — 1-5 Likert scale"
              realData={realQ1Dist}
              syntheticData={synQ1Dist}
              insight={`Synthetic mean: ${synQ1Mean.toFixed(2)} vs Real mean: ${BENCHMARK_PURCHASE_INTEREST.mean.toFixed(2)} (${"\u0394"}${(synQ1Mean - BENCHMARK_PURCHASE_INTEREST.mean).toFixed(2)}). Target: within ±0.3.`}
            />

            {/* Benchmark 2: Purchase Likelihood */}
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Benchmark 2 of 5</h2>
            <BenchmarkCard
              title="Purchase Likelihood (24 Months)"
              questionLabel="Real Q7 / Our Q2 — 1-5 Likert scale"
              realData={realQ2Dist}
              syntheticData={synQ2Dist}
              insight={`Synthetic mean: ${synQ2Mean.toFixed(2)} vs Real mean: ${BENCHMARK_PURCHASE_LIKELIHOOD.mean.toFixed(2)} (${"\u0394"}${(synQ2Mean - BENCHMARK_PURCHASE_LIKELIHOOD.mean).toFixed(2)}). Even stronger "would not buy" signal in real data.`}
            />

            {/* Benchmark 3: Primary Use Case */}
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Benchmark 3 of 5</h2>
            <BenchmarkCard
              title="Primary Use Case"
              questionLabel="Real Q8 / Our Q3 — Categorical"
              realData={realQ3Dist}
              syntheticData={synQ3Dist}
              topRealLabel={topRealQ3}
              topSynLabel={topSynQ3}
              insight="Critical LLM bias test: storage/shed should rank #1 (26.7% in reality), not home office. LLMs tend to over-index on 'home office' due to post-COVID training data."
            />

            {/* Benchmark 4: Greatest Barrier */}
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Benchmark 4 of 5</h2>
            <BenchmarkCard
              title="Greatest Single Barrier"
              questionLabel="Real Q11 / Our Q6 — Categorical"
              realData={realQ6Dist}
              syntheticData={synQ6Dist}
              topRealLabel={topRealQ6}
              topSynLabel={topSynQ6}
              insight="Cost (~$23K) dominates at 59.7% in reality. The pipeline must capture this overwhelming cost sensitivity."
            />

            {/* Benchmark 5: Best Concept */}
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Benchmark 5 of 5</h2>
            <BenchmarkCard
              title="Most Motivating Concept"
              questionLabel="Real Q29 / Our Q14 — Categorical"
              realData={realQ14Dist}
              syntheticData={synQ14Dist}
              topRealLabel={topRealQ14}
              topSynLabel={topSynQ14}
              insight='24% of real respondents say "None of the above" — a genuine disinterest signal that synthetic data must capture. Wellness edges out Home Office.'
            />

            {/* Methodology Note */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 mt-8">
              <h3 className="text-sm font-semibold text-white mb-2">Methodology</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Synthetic data generated by 3 independent LLMs (GPT-4.1-mini, Gemini-2.5-Flash, Claude-Sonnet-4.6) using
                STAMP-aligned codebook prompts with per-question calibration anchors. 90 respondents across 5 demographic
                segments. Real benchmark data from aytm survey of N=600 US homeowners provided by hackathon organizers.
                Statistical validation uses two-sample Kolmogorov-Smirnov tests, bootstrap 95% confidence intervals,
                and Krippendorff&apos;s alpha for inter-LLM reliability.
              </p>
              <div className="flex gap-3 mt-3">
                <Link href="/methodology" className="text-xs text-blue-400 hover:text-blue-300">STAMP Methodology &rarr;</Link>
                <Link href="/deliverables" className="text-xs text-amber-400 hover:text-amber-300">Deliverables &rarr;</Link>
                <Link href="/insights" className="text-xs text-violet-400 hover:text-violet-300">Insights &rarr;</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
