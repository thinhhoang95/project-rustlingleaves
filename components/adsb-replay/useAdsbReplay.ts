"use client";

import { useEffect, useMemo, useState } from "react";
import { applyFlightOperationCatalog, parseFlightOperationCatalog } from "./flight-operation-catalog";
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
        const [flightsResponse, catalogText] = await Promise.all([
          fetch("/data/flights.jsonl", { cache: "force-cache" }),
          fetch("/data/2026-04-01_landings_and_departures.csv", { cache: "force-cache" })
            .then((response) => (response.ok ? response.text() : ""))
            .catch(() => ""),
        ]);
        if (!flightsResponse.ok) {
          throw new Error(`Failed to load ADS-B flights (${flightsResponse.status})`);
        }

        const parsedAdsbFlights = parseFlightsJsonl(await flightsResponse.text());
        const parsedFlights = catalogText
          ? applyFlightOperationCatalog(parsedAdsbFlights, parseFlightOperationCatalog(catalogText))
          : parsedAdsbFlights;
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
