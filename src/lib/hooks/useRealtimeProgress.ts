"use client";

import { useEffect, useCallback, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface StageProgress {
  stage: number;
  status: string;
  progress_pct: number;
  message: string | null;
  started_at: string | null;
  completed_at: string | null;
  tokens_used: number | null;
  cost_estimate: number | null;
}

export function useRealtimeProgress(
  runId: string | null,
  onUpdate: (progress: StageProgress) => void
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const subscribe = useCallback(() => {
    if (!runId) return;

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`pipeline-progress-${runId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stage_progress",
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const row = payload.new as StageProgress;
          onUpdateRef.current(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [runId]);

  useEffect(() => {
    return subscribe();
  }, [subscribe]);
}
