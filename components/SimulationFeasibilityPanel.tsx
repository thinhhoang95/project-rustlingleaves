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

type SimulationFeasibilityPanelProps = {
  refreshToken: number;
  onClose: () => void;
  onSelectFlight: (flightId: string) => void;
};

type FeasibilityIssue = {
  flightNumber: string;
  flightId: string;
  missingDistanceNmi: number;
  simulationMessage: string;
};

type MissingDistanceHistogramBin = {
  label: string;
  rangeLabel: string;
  count: number;
};

const FEASIBILITY_ENDPOINT = "/tools/evals/feasibility";
const HISTOGRAM_BIN_WIDTHS = [0.25, 0.5, 1, 2, 5, 10, 20, 50];
const DISCLOSURE_INCREMENT = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseFeasibilityIssues(payload: unknown): FeasibilityIssue[] {
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected feasibility response");
  }

  return payload
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const flightId = readString(item.flight_id);
      const flightNumber = readString(item.flight_number);

      if (!flightId || !flightNumber) {
        return null;
      }

      return {
        flightNumber,
        flightId,
        missingDistanceNmi: readNumber(item.missing_distance_nmi),
        simulationMessage: readString(item.simulation_message),
      };
    })
    .filter((item): item is FeasibilityIssue => item !== null);
}

function formatNauticalMiles(value: number): string {
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} nm`;
}

function formatHistogramBoundary(value: number, binWidth: number): string {
  if (binWidth < 1) {
    return value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  }

  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function getHistogramBinWidth(maxDistanceNmi: number): number {
  const targetWidth = Math.max(maxDistanceNmi / 6, HISTOGRAM_BIN_WIDTHS[0]);
  return HISTOGRAM_BIN_WIDTHS.find((width) => width >= targetWidth) ?? HISTOGRAM_BIN_WIDTHS[HISTOGRAM_BIN_WIDTHS.length - 1];
}

function buildMissingDistanceHistogram(issues: FeasibilityIssue[]): MissingDistanceHistogramBin[] {
  if (!issues.length) {
    return [];
  }

  const maxDistanceNmi = Math.max(...issues.map((issue) => issue.missingDistanceNmi));
  const binWidth = getHistogramBinWidth(maxDistanceNmi);
  const binCount = Math.max(1, Math.ceil(maxDistanceNmi / binWidth));
  const bins = Array.from({ length: binCount }, (_, index) => {
    const from = index * binWidth;
    const to = from + binWidth;
    const label = `${formatHistogramBoundary(from, binWidth)}-${formatHistogramBoundary(to, binWidth)}`;

    return {
      label,
      rangeLabel: `${label} nm`,
      count: 0,
    };
  });

  issues.forEach((issue) => {
    const binIndex = Math.min(binCount - 1, Math.floor(issue.missingDistanceNmi / binWidth));
    bins[binIndex].count += 1;
  });

  return bins;
}

function MissingDistanceHistogramTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const bin = payload[0]?.payload as MissingDistanceHistogramBin | undefined;
  if (!bin) {
    return null;
  }

  return (
    <div className="feasibility-chart-tooltip">
      <span>{bin.rangeLabel}</span>
      <strong>{bin.count} flight{bin.count === 1 ? "" : "s"}</strong>
    </div>
  );
}

export default function SimulationFeasibilityPanel({
  refreshToken,
  onClose,
  onSelectFlight,
}: SimulationFeasibilityPanelProps) {
  const [issues, setIssues] = useState<FeasibilityIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualRefreshToken, setManualRefreshToken] = useState(0);
  const [visibleIssueCount, setVisibleIssueCount] = useState(DISCLOSURE_INCREMENT);
  const histogramData = useMemo(() => buildMissingDistanceHistogram(issues), [issues]);
  const visibleIssues = useMemo(
    () => issues.slice(0, visibleIssueCount),
    [issues, visibleIssueCount],
  );
  const hiddenIssueCount = Math.max(0, issues.length - visibleIssues.length);
  const largestMissingDistanceNmi = useMemo(
    () =>
      issues.length > 0
        ? Math.max(...issues.map((issue) => issue.missingDistanceNmi))
        : 0,
    [issues],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeasibilityIssues() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(FEASIBILITY_ENDPOINT, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load feasibility eval (${response.status})`);
        }

        const payload = await response.json();
        setIssues(parseFeasibilityIssues(payload));
        setVisibleIssueCount(DISCLOSURE_INCREMENT);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load feasibility eval");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadFeasibilityIssues();

    return () => controller.abort();
  }, [manualRefreshToken, refreshToken]);

  return (
    <section className="side-panel simulation-feasibility-panel" aria-label="Simulation feasibility check">
      <div className="side-panel-header">
        <div>
          <span className="side-panel-kicker">Simulation eval</span>
          <h2>Feasibility check</h2>
        </div>
        <div className="side-panel-actions">
          {issues.length > 0 ? <span className="feasibility-count">{issues.length}</span> : null}
          <button
            type="button"
            className="side-panel-refresh"
            aria-label="Refresh feasibility eval"
            title="Refresh feasibility eval"
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
            aria-label="Close feasibility panel"
            onClick={onClose}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {error ? <p className="feasibility-error">{error}</p> : null}
      {loading && issues.length === 0 && !error ? <p className="feasibility-loading">Loading feasibility check...</p> : null}

      {issues.length > 0 ? (
        <>
          <div className="simulation-summary" aria-label="Feasibility summary">
            <div>
              <span>Largest missing</span>
              <strong>{formatNauticalMiles(largestMissingDistanceNmi)}</strong>
            </div>
          </div>

          <div className="feasibility-chart-section">
            <div className="feasibility-chart-header">
              <span>Missing distance distribution</span>
            </div>
            <div className="feasibility-chart" aria-label="Missing distance histogram">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 270, height: 132 }}>
                <BarChart data={histogramData} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
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
                    content={(tooltipProps) => <MissingDistanceHistogramTooltip {...tooltipProps} />}
                    cursor={{ fill: "rgba(248, 113, 113, 0.12)" }}
                  />
                  <Bar dataKey="count" fill="rgba(248, 113, 113, 0.88)" radius={[5, 5, 2, 2]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <table className="feasibility-table" aria-label="Infeasible arrival flights">
            <thead>
              <tr>
                <th scope="col">Flight</th>
                <th scope="col">Missing (NM)</th>
              </tr>
            </thead>
            <tbody>
              {visibleIssues.map((issue) => (
                <tr key={issue.flightId}>
                  <td>
                    <button
                      type="button"
                      className="feasibility-flight-button"
                      title={issue.simulationMessage || `Select ${issue.flightId}`}
                      onClick={() => onSelectFlight(issue.flightId)}
                    >
                      {issue.flightNumber}
                    </button>
                  </td>
                  <td>{formatNauticalMiles(issue.missingDistanceNmi)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {hiddenIssueCount > 0 ? (
            <button
              type="button"
              className="simulation-show-more-button"
              onClick={() =>
                setVisibleIssueCount((count) =>
                  Math.min(count + DISCLOSURE_INCREMENT, issues.length),
                )
              }
            >
              Show more ({hiddenIssueCount} remaining)
            </button>
          ) : null}
        </>
      ) : null}

      {!loading && !error && issues.length === 0 ? (
        <p className="feasibility-empty">No infeasible arrivals.</p>
      ) : null}

      {loading && issues.length > 0 ? <div className="feasibility-loading">Refreshing...</div> : null}
    </section>
  );
}
