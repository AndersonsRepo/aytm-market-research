"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { SectionHeader, StatCard, LoadingSpinner, Tag } from "../ui";
import { MarkdownText } from "../MarkdownText";

export function Stage1Discovery({ runId }: { runId: string }) {
  const [brief, setBrief] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQ, setSelectedQ] = useState<string | null>(null);

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

  const models = useMemo(() => [...new Set(responses.map(r => r.model))].sort(), [responses]);
  const questions = useMemo(() => {
    const seen = new Map<string, { key: string; label: string; text: string }>();
    responses.forEach(r => {
      if (!seen.has(r.question_key)) {
        seen.set(r.question_key, { key: r.question_key, label: r.question_label, text: r.question_text });
      }
    });
    return Array.from(seen.values());
  }, [responses]);

  if (loading) return <LoadingSpinner />;
  if (!brief && responses.length === 0) return <p className="text-gray-500 text-sm">No discovery data found.</p>;

  const activeQ = selectedQ || questions[0]?.key || null;
  const activeQData = questions.find(q => q.key === activeQ);

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Models Used" value={models.length} />
        <StatCard label="Questions Asked" value={questions.length} />
        <StatCard label="Total Responses" value={responses.length} />
      </div>

      {/* Brief Summary */}
      {brief && (
        <>
          {brief.product_summary && (
            <div>
              <SectionHeader>Product Summary</SectionHeader>
              <p className="text-sm text-gray-300 leading-relaxed bg-gray-800/40 rounded-lg p-4 border-l-4 border-blue-500">
                {brief.product_summary || brief.productSummary}
              </p>
            </div>
          )}

          {(brief.target_segments || brief.targetSegments || []).length > 0 && (
            <div>
              <SectionHeader>Target Segments</SectionHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(brief.target_segments || brief.targetSegments || []).map((seg: any, i: number) => (
                  <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                    <div className="text-sm font-medium text-white">
                      {typeof seg === "string" ? seg : seg.name || seg.label}
                    </div>
                    {typeof seg !== "string" && seg.description && (
                      <div className="text-xs text-gray-400 mt-1">{seg.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(brief.key_barriers || brief.keyBarriers || []).length > 0 && (
            <div>
              <SectionHeader>Key Barriers</SectionHeader>
              <div className="space-y-2">
                {(brief.key_barriers || brief.keyBarriers || []).map((b: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 px-4 py-2 bg-red-950/10 border border-red-900/30 rounded-lg">
                    <span className="text-red-400 mt-0.5 text-sm">&#x2022;</span>
                    <span className="text-sm text-gray-300">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(brief.positioning_strategy || brief.positioningStrategy) && (
            <div>
              <SectionHeader>Positioning Strategy</SectionHeader>
              <p className="text-sm text-gray-300 leading-relaxed bg-gray-800/40 rounded-lg p-4 border-l-4 border-purple-500">
                {brief.positioning_strategy || brief.positioningStrategy}
              </p>
            </div>
          )}
        </>
      )}

      {/* Side-by-Side Model Responses */}
      {questions.length > 0 && (
        <div>
          <SectionHeader>Model Responses — Side by Side</SectionHeader>
          <div className="flex flex-wrap gap-2 mb-4">
            {questions.map(q => (
              <button key={q.key}
                onClick={() => setSelectedQ(q.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeQ === q.key ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}>
                {q.label || q.key}
              </button>
            ))}
          </div>

          {activeQData && (
            <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400 italic mb-4">{activeQData.text}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {models.map(m => {
                  const r = responses.find(r => r.question_key === activeQ && r.model === m);
                  return (
                    <div key={m} className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                      <Tag>{(m as string).split("/").pop() || m}</Tag>
                      <div className="mt-2">
                        {r ? <MarkdownText text={r.response} /> : <p className="text-xs text-gray-500">No response</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
