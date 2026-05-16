"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { MapCoordinate } from "@/components/map-view-types";

type SimulationConflictsPanelProps = {
  refreshToken: number;
  onClose: () => void;
  onSelectConflict: (selection: SimulationConflictSelection) => void;
};

export type SimulationConflictSelection = {
  conflictId: string;
  time: number;
  coordinate: MapCoordinate;
  flightIds: [string, string];
};

type ConflictFlight = {
  flightNumber: string;
  flightId: string;
  runway: string;
};

type SimulationConflict = {
  id: string;
  flightA: ConflictFlight;
  flightB: ConflictFlight;
  startTime: number;
  endTime: number;
  closestTime: number;
  closestTimeUtc: string;
  coordinate: MapCoordinate;
  lateralDistanceNmi: number;
  verticalSeparationFt: number;
  lateralThresholdNmi: number;
  verticalThresholdFt: number;
  severity: number;
  confidence: "confirmed" | "possible";
};

type ConflictHistogramBin = {
  label: string;
  rangeLabel: string;
  count: number;
};

const CONFLICTS_ENDPOINT = "/tools/evals/conflicts";
const DISCLOSURE_INCREMENT = 50;
const LATERAL_HISTOGRAM_BIN_WIDTHS = [0.25, 0.5, 1, 2, 5, 10, 20, 50];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampSeverity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseConflictFlight(value: unknown): ConflictFlight | null {
  if (!isRecord(value)) {
    return null;
  }

  const flightId = readString(value.flight_id);
  const flightNumber = readString(value.flight_number) || flightId;

  if (!flightId || !flightNumber) {
    return null;
  }

  return {
    flightNumber,
    flightId,
    runway: readString(value.runway),
  };
}

function parseConflictConfidence(value: unknown): "confirmed" | "possible" {
  return readString(value).toLowerCase() === "possible" ? "possible" : "confirmed";
}

function parseConflicts(payload: unknown): SimulationConflict[] {
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected conflicts response");
  }

  return payload
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const flightA = parseConflictFlight(item.flight_a);
      const flightB = parseConflictFlight(item.flight_b);
      const latitude = readNumber(item.latitude);
      const longitude = readNumber(item.longitude);
      const closestTime = readNumber(item.closest_time);

      if (!flightA || !flightB || latitude === null || longitude === null || closestTime === null) {
        return null;
      }

      const startTime = readNumber(item.start_time) ?? closestTime;
      const endTime = readNumber(item.end_time) ?? closestTime;
      const severity = clampSeverity(readNumber(item.severity) ?? 0);
      const id = [
        flightA.flightId,
        flightB.flightId,
        Math.round(closestTime),
        latitude.toFixed(5),
        longitude.toFixed(5),
      ].join(":");

      return {
        id,
        flightA,
        flightB,
        startTime,
        endTime,
        closestTime,
        closestTimeUtc: readString(item.closest_time_utc),
        coordinate: [longitude, latitude] as MapCoordinate,
        lateralDistanceNmi: readNumber(item.lateral_distance_nmi) ?? 0,
        verticalSeparationFt: readNumber(item.vertical_separation_ft) ?? 0,
        lateralThresholdNmi: readNumber(item.lateral_threshold_nmi) ?? 10,
        verticalThresholdFt: readNumber(item.vertical_threshold_ft) ?? 1000,
        severity,
        confidence: parseConflictConfidence(item.confidence),
      };
    })
    .filter((item): item is SimulationConflict => item !== null)
    .sort((left, right) => right.severity - left.severity || left.closestTime - right.closestTime);
}

function formatUtcTime(utcValue: string, epochSeconds: number): string {
  const date = new Date(utcValue || epochSeconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return `${date.toISOString().slice(11, 19)}Z`;
}

function formatDuration(startTime: number, endTime: number): string {
  const durationSeconds = Math.max(0, Math.round(endTime - startTime));
  if (durationSeconds < 60) {
    return `${durationSeconds}s`;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatNauticalMiles(value: number): string {
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function formatHistogramBoundary(value: number, binWidth: number): string {
  if (binWidth < 1) {
    return value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  }

  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function formatFeet(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} ft`;
}

function formatSeverity(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function getSeverityLabel(value: number): string {
  if (value >= 0.75) {
    return "High";
  }
  if (value >= 0.45) {
    return "Medium";
  }
  return "Low";
}

function getRunwayPairLabel(conflict: SimulationConflict): string {
  const left = conflict.flightA.runway || "Runway ?";
  const right = conflict.flightB.runway || "Runway ?";
  return `${left} / ${right}`;
}

function buildSeverityHistogram(conflicts: SimulationConflict[]): ConflictHistogramBin[] {
  const bins = Array.from({ length: 10 }, (_, index) => {
    const from = index * 10;
    const to = from + 10;

    return {
      label: `${from}-${to}`,
      rangeLabel: `${from}-${to}% severity`,
      count: 0,
    };
  });

  conflicts.forEach((conflict) => {
    const binIndex = Math.min(bins.length - 1, Math.floor(conflict.severity * bins.length));
    bins[binIndex].count += 1;
  });

  return bins;
}

function getLateralHistogramBinWidth(maxDistanceNmi: number): number {
  const targetWidth = Math.max(maxDistanceNmi / 6, LATERAL_HISTOGRAM_BIN_WIDTHS[0]);
  return LATERAL_HISTOGRAM_BIN_WIDTHS.find((width) => width >= targetWidth) ?? LATERAL_HISTOGRAM_BIN_WIDTHS[LATERAL_HISTOGRAM_BIN_WIDTHS.length - 1];
}

function buildLateralHistogram(conflicts: SimulationConflict[]): ConflictHistogramBin[] {
  if (!conflicts.length) {
    return [];
  }

  const maxDistanceNmi = Math.max(...conflicts.map((conflict) => conflict.lateralDistanceNmi));
  const binWidth = getLateralHistogramBinWidth(maxDistanceNmi);
  const binCount = Math.max(1, Math.ceil(maxDistanceNmi / binWidth));
  const bins = Array.from({ length: binCount }, (_, index) => {
    const from = index * binWidth;
    const to = from + binWidth;
    const label = `${formatHistogramBoundary(from, binWidth)}-${formatHistogramBoundary(to, binWidth)}`;

    return {
      label,
      rangeLabel: `${label} nm lateral`,
      count: 0,
    };
  });

  conflicts.forEach((conflict) => {
    const binIndex = Math.min(binCount - 1, Math.floor(conflict.lateralDistanceNmi / binWidth));
    bins[binIndex].count += 1;
  });

  return bins;
}

function ConflictHistogramTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const bin = payload[0]?.payload as ConflictHistogramBin | undefined;
  if (!bin) {
    return null;
  }

  return (
    <div className="conflict-chart-tooltip">
      <span>{bin.rangeLabel}</span>
      <strong>{bin.count} conflict{bin.count === 1 ? "" : "s"}</strong>
    </div>
  );
}

export default function SimulationConflictsPanel({
  refreshToken,
  onClose,
  onSelectConflict,
}: SimulationConflictsPanelProps) {
  const [conflicts, setConflicts] = useState<SimulationConflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualRefreshToken, setManualRefreshToken] = useState(0);
  const [visibleConflictCount, setVisibleConflictCount] = useState(DISCLOSURE_INCREMENT);
  const worstConflict = useMemo(() => conflicts[0] ?? null, [conflicts]);
  const closestConflict = useMemo(
    () =>
      conflicts.length > 0
        ? conflicts.reduce((closest, conflict) =>
            conflict.lateralDistanceNmi < closest.lateralDistanceNmi ? conflict : closest,
          )
        : null,
    [conflicts],
  );
  const visibleConflicts = useMemo(
    () => conflicts.slice(0, visibleConflictCount),
    [conflicts, visibleConflictCount],
  );
  const hiddenConflictCount = Math.max(0, conflicts.length - visibleConflicts.length);
  const severityHistogramData = useMemo(() => buildSeverityHistogram(conflicts), [conflicts]);
  const lateralHistogramData = useMemo(() => buildLateralHistogram(conflicts), [conflicts]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadConflicts() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(CONFLICTS_ENDPOINT, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load conflicts eval (${response.status})`);
        }

        const payload = await response.json();
        setConflicts(parseConflicts(payload));
        setVisibleConflictCount(DISCLOSURE_INCREMENT);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load conflicts eval");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadConflicts();

    return () => controller.abort();
  }, [manualRefreshToken, refreshToken]);

  function selectConflict(conflict: SimulationConflict) {
    onSelectConflict({
      conflictId: conflict.id,
      time: conflict.closestTime,
      coordinate: conflict.coordinate,
      flightIds: [conflict.flightA.flightId, conflict.flightB.flightId],
    });
  }

  return (
    <section className="side-panel simulation-conflicts-panel" aria-label="Simulation conflicts check">
      <div className="side-panel-header">
        <div>
          <span className="side-panel-kicker">Simulation eval</span>
          <h2>Conflict check</h2>
        </div>
        <div className="side-panel-actions">
          {conflicts.length > 0 ? <span className="conflict-count">{conflicts.length}</span> : null}
          <button
            type="button"
            className="side-panel-refresh"
            aria-label="Refresh conflicts eval"
            title="Refresh conflicts eval"
            disabled={loading}
            onClick={() => setManualRefreshToken((token) => token + 1)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M16 5v4h-4M4 15v-4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14.7 8A5 5 0 005.4 6.4M5.3 12a5 5 0 009.3 1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="side-panel-close"
            aria-label="Close conflicts panel"
            onClick={onClose}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {error ? <p className="conflict-error">{error}</p> : null}
      {loading && conflicts.length === 0 && !error ? <p className="conflict-loading">Loading conflict check...</p> : null}

      {conflicts.length > 0 ? (
        <>
          <div className="simulation-summary" aria-label="Conflict summary">
            <div>
              <span>Highest severity</span>
              <strong>{worstConflict ? formatSeverity(worstConflict.severity) : "0%"}</strong>
            </div>
            <div>
              <span>Closest lateral</span>
              <strong>{closestConflict ? `${formatNauticalMiles(closestConflict.lateralDistanceNmi)} nm` : "0.00 nm"}</strong>
            </div>
          </div>

          <div className="conflict-chart-grid" aria-label="Conflict distributions">
            <div className="conflict-chart-section">
              <div className="conflict-chart-header">
                <span>Severity distribution</span>
              </div>
              <div className="conflict-chart" aria-label="Severity histogram">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 270, height: 118 }}>
                  <BarChart data={severityHistogramData} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="rgba(159, 177, 195, 0.72)"
                      tick={{ fill: "rgba(159, 177, 195, 0.82)", fontSize: 8, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={{ stroke: "rgba(148, 163, 184, 0.18)" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="rgba(159, 177, 195, 0.72)"
                      tick={{ fill: "rgba(159, 177, 195, 0.82)", fontSize: 10, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={{ stroke: "rgba(148, 163, 184, 0.18)" }}
                    />
                    <Tooltip
                      content={(tooltipProps) => <ConflictHistogramTooltip {...tooltipProps} />}
                      cursor={{ fill: "rgba(251, 146, 60, 0.12)" }}
                    />
                    <Bar dataKey="count" fill="rgba(251, 146, 60, 0.88)" radius={[5, 5, 2, 2]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="conflict-chart-section">
              <div className="conflict-chart-header">
                <span>Lateral distribution</span>
              </div>
              <div className="conflict-chart" aria-label="Lateral distance histogram">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 270, height: 118 }}>
                  <BarChart data={lateralHistogramData} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="rgba(159, 177, 195, 0.72)"
                      tick={{ fill: "rgba(159, 177, 195, 0.82)", fontSize: 9, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={{ stroke: "rgba(148, 163, 184, 0.18)" }}
                      interval={0}
                    />
                    <YAxis
                      allowDecimals={false}
                      stroke="rgba(159, 177, 195, 0.72)"
                      tick={{ fill: "rgba(159, 177, 195, 0.82)", fontSize: 10, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={{ stroke: "rgba(148, 163, 184, 0.18)" }}
                    />
                    <Tooltip
                      content={(tooltipProps) => <ConflictHistogramTooltip {...tooltipProps} />}
                      cursor={{ fill: "rgba(251, 146, 60, 0.12)" }}
                    />
                    <Bar dataKey="count" fill="rgba(253, 186, 116, 0.86)" radius={[5, 5, 2, 2]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <table className="conflicts-table" aria-label="Arrival-pair conflicts">
            <thead>
              <tr>
                <th scope="col">Pair</th>
                <th scope="col">Lateral</th>
                <th scope="col">Severity</th>
              </tr>
            </thead>
            <tbody>
              {visibleConflicts.map((conflict) => {
                const severityLabel = getSeverityLabel(conflict.severity);

                return (
                  <tr
                    key={conflict.id}
                    className="conflict-row"
                    role="button"
                    tabIndex={0}
                    title="Move to conflict time and location"
                    onClick={() => selectConflict(conflict)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectConflict(conflict);
                      }
                    }}
                  >
                    <td>
                      <span className="conflict-pair-main">
                        <strong>{conflict.flightA.flightNumber}</strong>
                        <span>vs</span>
                        <strong>{conflict.flightB.flightNumber}</strong>
                      </span>
                      <span className="conflict-pair-sub">
                        {getRunwayPairLabel(conflict)} · {formatUtcTime(conflict.closestTimeUtc, conflict.closestTime)} · {formatDuration(conflict.startTime, conflict.endTime)}
                      </span>
                      <span className="conflict-pair-sub">
                        {formatFeet(conflict.verticalSeparationFt)} vertical · {conflict.confidence}
                      </span>
                    </td>
                    <td>
                      <strong>{formatNauticalMiles(conflict.lateralDistanceNmi)}</strong>
                      <span>nm</span>
                    </td>
                    <td>
                      <span className={`conflict-severity conflict-severity-${severityLabel.toLowerCase()}`}>
                        {formatSeverity(conflict.severity)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {hiddenConflictCount > 0 ? (
            <button
              type="button"
              className="simulation-show-more-button"
              onClick={() =>
                setVisibleConflictCount((count) =>
                  Math.min(count + DISCLOSURE_INCREMENT, conflicts.length),
                )
              }
            >
              Show more ({hiddenConflictCount} remaining)
            </button>
          ) : null}
        </>
      ) : null}

      {!loading && !error && conflicts.length === 0 ? (
        <p className="conflict-empty">No arrival-pair conflicts.</p>
      ) : null}

      {loading && conflicts.length > 0 ? <div className="conflict-loading">Refreshing...</div> : null}
    </section>
  );
}
