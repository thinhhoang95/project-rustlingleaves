"use client";

import { useEffect, useMemo, useState } from "react";
import { buildReplaySnapshot } from "./interpolate";
import { buildReplayMetadata, parseFlightsJsonl } from "./parser";
import type { ReplayFlight, ReplayMetadata, ReplaySnapshot } from "./types";

type AdsbReplayState = {
  flights: ReplayFlight[];
  metadata: ReplayMetadata | null;
  snapshot: ReplaySnapshot;
  loading: boolean;
  error: string | null;
};

export function useAdsbReplay(time: number): AdsbReplayState {
  const [flights, setFlights] = useState<ReplayFlight[]>([]);
  const [metadata, setMetadata] = useState<ReplayMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReplayData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/data/flights.jsonl", { cache: "force-cache" });
        if (!response.ok) {
          throw new Error(`Failed to load ADS-B flights (${response.status})`);
        }

        const parsedFlights = parseFlightsJsonl(await response.text());
        const parsedMetadata = buildReplayMetadata(parsedFlights);

        if (!parsedMetadata) {
          throw new Error("No ADS-B flights found");
        }

        if (cancelled) {
          return;
        }

        setFlights(parsedFlights);
        setMetadata(parsedMetadata);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load ADS-B replay");
        setFlights([]);
        setMetadata(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReplayData();

    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveTime = time || metadata?.minTime || 0;
  const snapshot = useMemo(() => buildReplaySnapshot(flights, effectiveTime), [effectiveTime, flights]);

  return {
    flights,
    metadata,
    snapshot,
    loading,
    error,
  };
}
