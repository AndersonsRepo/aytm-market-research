"use client";

import { useState, useCallback } from "react";

export type StageStatus = "locked" | "ready" | "running" | "completed" | "error";

export interface StageState {
  status: StageStatus;
  progress: number;
  message: string;
  data?: unknown;
}

export function usePipelineRun() {
  const [runId, setRunId] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "demo" | "live">("idle");
  const [stages, setStages] = useState<Record<number, StageState>>({});

  const updateStage = useCallback((stageId: number, update: Partial<StageState>) => {
    setStages(prev => ({
      ...prev,
      [stageId]: { ...prev[stageId], ...update },
    }));
  }, []);

  const reset = useCallback(() => {
    setRunId(null);
    setMode("idle");
    setStages({});
  }, []);

  return { runId, setRunId, mode, setMode, stages, updateStage, reset };
}
