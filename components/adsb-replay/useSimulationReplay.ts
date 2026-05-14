"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildReplaySnapshot } from "./interpolate";
import { buildReplayMetadata, parseFlightsJsonArray } from "./parser";
import type { ReplayFlight, ReplayMetadata, ReplaySnapshot } from "./types";

type SimulationReplayState = {
  flights: ReplayFlight[];
  metadata: ReplayMetadata | null;
  snapshot: ReplaySnapshot;
  loading: boolean;
  invalidating: boolean;
  error: string | null;
  invalidateCache: () => Promise<void>;
};

type CachedSimulationReplay = {
  flights: ReplayFlight[];
  metadata: ReplayMetadata;
};

const SIMULATION_CACHE_NAME = "simulation-replay-v2";
const SIMULATION_ENDPOINTS = ["/departures", "/arrivals"] as const;

let memoryCache: CachedSimulationReplay | null = null;

async function readJsonWithCache(endpoint: string): Promise<unknown> {
  if (typeof caches !== "undefined") {
    const cache = await caches.open(SIMULATION_CACHE_NAME);
    const cachedResponse = await cache.match(endpoint);
    if (cachedResponse) {
      return cachedResponse.json();
    }

    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load ${endpoint} (${response.status})`);
    }

    await cache.put(endpoint, response.clone());
    return response.json();
  }

  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${endpoint} (${response.status})`);
  }

  return response.json();
}

async function loadSimulationReplay(): Promise<CachedSimulationReplay> {
  if (memoryCache) {
    return memoryCache;
  }

  const [departuresPayload, arrivalsPayload] = await Promise.all(
    SIMULATION_ENDPOINTS.map((endpoint) => readJsonWithCache(endpoint)),
  );
  const flights = [
    ...parseFlightsJsonArray(departuresPayload),
    ...parseFlightsJsonArray(arrivalsPayload),
  ].sort((left, right) => left.firstTime - right.firstTime || left.callsign.localeCompare(right.callsign));
  const metadata = buildReplayMetadata(flights);

  if (!metadata) {
    throw new Error("No simulation flights found");
  }

  memoryCache = { flights, metadata };
  return memoryCache;
}

async function destroySimulationCache() {
  memoryCache = null;
  if (typeof caches !== "undefined") {
    await caches.delete(SIMULATION_CACHE_NAME);
  }
}

export function useSimulationReplay(time: number): SimulationReplayState {
  const [flights, setFlights] = useState<ReplayFlight[]>([]);
  const [metadata, setMetadata] = useState<ReplayMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalidating, setInvalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadReplayData() {
      setLoading(true);
      setError(null);

      try {
        const cachedReplay = await loadSimulationReplay();

        if (cancelled) {
          return;
        }

        setFlights(cachedReplay.flights);
        setMetadata(cachedReplay.metadata);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load simulation replay");
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
  }, [reloadToken]);

  const invalidateCache = useCallback(async () => {
    setInvalidating(true);
    setLoading(true);
    setError(null);

    try {
      await destroySimulationCache();
      setFlights([]);
      setMetadata(null);
      setReloadToken((previousToken) => previousToken + 1);
    } catch (invalidateError) {
      setError(
        invalidateError instanceof Error
          ? invalidateError.message
          : "Failed to invalidate simulation cache",
      );
      setLoading(false);
    } finally {
      setInvalidating(false);
    }
  }, []);

  const effectiveTime = time || metadata?.minTime || 0;
  const snapshot = useMemo(() => buildReplaySnapshot(flights, effectiveTime), [effectiveTime, flights]);

  return {
    flights,
    metadata,
    snapshot,
    loading,
    invalidating,
    error,
    invalidateCache,
  };
}
