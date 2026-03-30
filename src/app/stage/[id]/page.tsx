"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Stage1Discovery } from "@/components/pipeline/stages/Stage1Discovery";
import { Stage2Interviews } from "@/components/pipeline/stages/Stage2Interviews";
import { Stage3Survey } from "@/components/pipeline/stages/Stage3Survey";
import { Stage4Responses } from "@/components/pipeline/stages/Stage4Responses";
import { Stage5Analysis } from "@/components/pipeline/stages/Stage5Analysis";
import { Stage6Validation } from "@/components/pipeline/stages/Stage6Validation";

const STAGE_META: Record<number, { name: string; description: string }> = {
  1: { name: "Client Discovery", description: "3-LLM structured interview with founding team" },
  2: { name: "Consumer Interviews", description: "30 depth interviews with adaptive follow-ups" },
  3: { name: "Survey Design", description: "AI-assisted instrument generation from themes" },
  4: { name: "Survey Responses", description: "90 synthetic respondents across 5 segments" },
  5: { name: "Data Analysis", description: "Statistical tests, bias detection, quality scoring" },
  6: { name: "Validation Report", description: "Quality grade, confidence intervals, audit trail" },
};

export default function StageDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const stageId = Number(params.id);
  const runId = searchParams.get("runId");
  const meta = STAGE_META[stageId];

  if (!meta || !runId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <p className="text-gray-400">Invalid stage or missing run ID.</p>
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm mt-4 inline-block">
          &larr; Back to Pipeline
        </Link>
      </div>
    );
  }

  // Map stage ID to component — all 6 stages have dedicated detail views
  const stageComponents: Record<number, React.ReactNode> = {
    1: <Stage1Discovery runId={runId} />,
    2: <Stage2Interviews runId={runId} />,
    3: <Stage3Survey runId={runId} />,
    4: <Stage4Responses runId={runId} />,
    5: <Stage5Analysis runId={runId} />,
    6: <Stage6Validation runId={runId} />,
  };

  const StageContent = stageComponents[stageId] || (
    <div className="text-center py-12">
      <p className="text-gray-400 text-lg">Detailed view for Stage {stageId} coming soon.</p>
      <p className="text-gray-500 text-sm mt-2">Use the pipeline overview to see summary results.</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Navigation */}
      <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm mb-6 inline-flex items-center gap-1">
        <span>&larr;</span> Back to Pipeline
      </Link>

      {/* Stage Header */}
      <div className="mb-8 mt-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white font-bold text-lg">
            {stageId}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white">{meta.name}</h1>
            <p className="text-gray-400 text-sm">{meta.description}</p>
          </div>
        </div>

        {/* Stage nav pills */}
        <div className="flex gap-2 mt-4">
          {Object.entries(STAGE_META).map(([id, m]) => {
            const n = Number(id);
            const isCurrent = n === stageId;
            return (
              <Link
                key={id}
                href={`/stage/${id}?runId=${runId}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isCurrent
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                }`}
              >
                {n}. {m.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Stage Content */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-6">
        {StageContent}
      </div>

      {/* Prev / Next Navigation */}
      <div className="mt-6 flex items-center justify-between">
        {stageId > 1 ? (
          <Link
            href={`/stage/${stageId - 1}?runId=${runId}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-sm font-medium"
          >
            <span>&larr;</span>
            <span>Stage {stageId - 1}: {STAGE_META[stageId - 1]?.name}</span>
          </Link>
        ) : <div />}

        <span className="text-xs text-gray-600 font-mono">
          Run: {runId.slice(0, 8)}...
        </span>

        {stageId < 6 ? (
          <Link
            href={`/stage/${stageId + 1}?runId=${runId}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-medium"
          >
            <span>Stage {stageId + 1}: {STAGE_META[stageId + 1]?.name}</span>
            <span>&rarr;</span>
          </Link>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-700 text-white hover:bg-green-600 transition-colors text-sm font-medium"
          >
            <span>Back to Pipeline</span>
            <span>&rarr;</span>
          </Link>
        )}
      </div>
    </div>
  );
}
