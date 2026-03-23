"use client";

import { useState, useCallback } from "react";
import { StageCard } from "./StageCard";
import { RunControls } from "./RunControls";
import { useRealtimeProgress } from "@/lib/hooks/useRealtimeProgress";

const STAGES = [
  { id: 1, name: "Client Discovery", description: "3-LLM structured interview with founding team" },
  { id: 2, name: "Consumer Interviews", description: "30 depth interviews with adaptive follow-ups" },
  { id: 3, name: "Survey Design", description: "AI-assisted instrument generation from themes" },
  { id: 4, name: "Survey Responses", description: "90 synthetic respondents across 5 segments" },
  { id: 5, name: "Data Analysis", description: "Statistical tests, bias detection, quality scoring" },
  { id: 6, name: "Validation Report", description: "Quality grade, confidence intervals, audit trail" },
];

type StageStatus = "locked" | "ready" | "running" | "completed" | "error";

interface StageState {
  status: StageStatus;
  progress: number;
  message: string;
}

export function PipelineLayout() {
  const [runId, setRunId] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "demo" | "live">("idle");
  const [apiKey, setApiKey] = useState("");
  const [stages, setStages] = useState<Record<number, StageState>>(
    Object.fromEntries(STAGES.map(s => [s.id, { status: "locked" as StageStatus, progress: 0, message: "" }]))
  );
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const updateStage = useCallback((stageId: number, update: Partial<StageState>) => {
    setStages(prev => ({
      ...prev,
      [stageId]: { ...prev[stageId], ...update },
    }));
  }, []);

  // Wire up realtime progress updates from Supabase
  useRealtimeProgress(runId, (progress) => {
    const statusMap: Record<string, StageStatus> = {
      pending: "locked",
      running: "running",
      completed: "completed",
      error: "error",
    };
    const mappedStatus = statusMap[progress.status] || (progress.status as StageStatus);

    updateStage(progress.stage, {
      status: mappedStatus,
      progress: progress.progress_pct,
      message: progress.message || "",
    });

    // When a stage completes via realtime, auto-unlock the next stage
    if (mappedStatus === "completed" && progress.stage < 6) {
      setStages(prev => {
        const next = progress.stage + 1;
        // Only unlock if next stage is still locked
        if (prev[next]?.status === "locked") {
          return { ...prev, [next]: { ...prev[next], status: "ready" } };
        }
        return prev;
      });
    }
  });

  const handleStart = useCallback(async (selectedMode: "demo" | "live", key?: string) => {
    setMode(selectedMode);
    if (key) setApiKey(key);

    try {
      const res = await fetch("/api/pipeline/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });
      const data = await res.json();
      setRunId(data.runId);

      if (selectedMode === "demo") {
        // In demo mode, seed data and mark all stages completed
        await fetch("/api/pipeline/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: data.runId }),
        });
        STAGES.forEach(s => updateStage(s.id, { status: "completed", progress: 100 }));
        setExpandedStage(1);
      } else {
        // In live mode, unlock stage 1
        updateStage(1, { status: "ready" });
      }
    } catch (err) {
      console.error("Failed to start pipeline:", err);
    }
  }, [updateStage]);

  const handleRunStage = useCallback(async (stageId: number) => {
    if (!runId) return;
    updateStage(stageId, { status: "running", progress: 0, message: "Starting..." });

    try {
      const res = await fetch(`/api/pipeline/${stageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, openrouterKey: apiKey }),
      });

      if (!res.ok) {
        const err = await res.json();
        updateStage(stageId, { status: "error", message: err.error || "Stage failed" });
        return;
      }

      updateStage(stageId, { status: "completed", progress: 100, message: "Complete" });
      setExpandedStage(stageId);

      // Unlock next stage
      if (stageId < 6) {
        updateStage(stageId + 1, { status: "ready" });
      }
    } catch (err) {
      updateStage(stageId, { status: "error", message: String(err) });
    }
  }, [runId, apiKey, updateStage]);

  const handleAutoRun = useCallback(async () => {
    for (const stage of STAGES) {
      await handleRunStage(stage.id);
      // Check if previous stage errored — need to read from latest state
      const currentStages = await new Promise<Record<number, StageState>>(resolve => {
        setStages(prev => { resolve(prev); return prev; });
      });
      if (currentStages[stage.id]?.status === "error") break;
    }
  }, [handleRunStage]);

  const handleReset = useCallback(() => {
    setRunId(null);
    setMode("idle");
    setApiKey("");
    setExpandedStage(null);
    setStages(
      Object.fromEntries(STAGES.map(s => [s.id, { status: "locked" as StageStatus, progress: 0, message: "" }]))
    );
  }, []);

  const hasReadyStage = Object.values(stages).some(s => s.status === "ready");

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-400 text-xs font-medium mb-4">
          STAMP Methodology
        </div>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          AYTM Research Pipeline
        </h1>
        <p className="text-gray-400 text-lg">Neo Smart Living &mdash; Tahoe Mini Market Research</p>
        <p className="text-gray-500 text-sm mt-1">3-model triangulation &middot; 6 automated stages &middot; Full audit trail</p>
      </header>

      <RunControls
        mode={mode}
        onStart={handleStart}
        onReset={handleReset}
        onAutoRun={mode === "live" && hasReadyStage ? handleAutoRun : undefined}
      />

      <div className="mt-8 space-y-4">
        {STAGES.map((stage) => (
          <StageCard
            key={stage.id}
            stage={stage}
            state={stages[stage.id]}
            isExpanded={expandedStage === stage.id}
            runId={runId}
            onRun={() => handleRunStage(stage.id)}
            onToggle={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
          />
        ))}
      </div>

      {mode !== "idle" && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gray-900 border border-gray-800 text-xs text-gray-500">
            <span>Run ID: <span className="font-mono text-gray-400">{runId?.slice(0, 8)}...</span></span>
            <span className="w-px h-3 bg-gray-700" />
            <span>Mode: <span className="text-gray-400">{mode}</span></span>
            <span className="w-px h-3 bg-gray-700" />
            <span>Est. cost: <span className="text-gray-400">~$0.10</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
