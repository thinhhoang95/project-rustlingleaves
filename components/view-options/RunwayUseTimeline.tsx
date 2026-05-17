"use client";

import { GitCompareArrows, SlidersHorizontal } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { ReplayFlight, ReplayMode } from "@/components/adsb-replay/types";

export const DEPARTURE_RUNWAY_OCCUPANCY_SECONDS = 90;
export const ARRIVAL_RUNWAY_OCCUPANCY_SECONDS = 60;

const RUNWAY_LABEL_WIDTH = 58;
const MIN_TIMELINE_WIDTH = 640;
const ROW_HEIGHT = 30;
const TICK_TARGET_WIDTH = 112;
const TEMPORAL_SCALE_SECONDS_PER_PIXEL = [0.5, 1, 2, 3, 5, 10, 15, 30, 60, 120] as const;
const DEFAULT_TEMPORAL_SCALE_INDEX = 6;
const TICK_INTERVAL_SECONDS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 14400] as const;
const OVERLAP_DURATION_FILTER_OPTIONS = [5, 10, 30, 60] as const;
const OVERLAP_INTERACTION_FILTER_OPTIONS = ["DEP-ARR", "ARR-DEP", "ARR-ARR", "DEP-DEP"] as const;

type RunwayUseTimelineProps = {
  replayMode: ReplayMode;
  flights: ReplayFlight[];
  replayTime: number;
  replayMinTime: number;
  replayMaxTime: number;
  replayLoading: boolean;
  runwayUseTimelineRequestToken?: number;
  onReplayTimeChange?: (time: number) => void;
  onOccupancySelect?: (flightId: string, time: number) => void;
};

type RunwayOccupancy = {
  id: string;
  flight: ReplayFlight;
  runway: string;
  operation: "departure" | "arrival";
  startTime: number;
  endTime: number;
};

type RunwayTimelineRow = {
  runway: string;
  occupancies: RunwayOccupancy[];
};

type RunwayOverlapUse = {
  flightNumber: string;
  icao24?: string;
  flightId: string;
  operation: "departure" | "arrival";
  runway?: string;
};

type RunwayOverlap = {
  id: string;
  runway: string;
  useA: RunwayOverlapUse;
  useB: RunwayOverlapUse;
  startTime: number;
  endTime: number;
  overlappingTime: number;
  overlappingTimeUtc?: string;
  overlappingDuration: number;
};

type RunwayOverlapInteraction = (typeof OVERLAP_INTERACTION_FILTER_OPTIONS)[number];

function normalizeRunwayName(runway: string | undefined): string | null {
  const normalizedRunway = runway?.trim().toUpperCase().replace(/^RW/, "");
  return normalizedRunway || null;
}

function runwaySortValue(runway: string): [number, number, string] {
  const match = runway.match(/^(\d{1,2})([LCR])?$/);
  if (!match) {
    return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, runway];
  }

  const suffixOrder: Record<string, number> = {
    L: 0,
    C: 1,
    R: 2,
    "": 3,
  };

  return [Number(match[1]), suffixOrder[match[2] ?? ""] ?? 4, runway];
}

function compareRunways(left: string, right: string): number {
  const leftValue = runwaySortValue(left);
  const rightValue = runwaySortValue(right);

  return (
    leftValue[0] - rightValue[0] ||
    leftValue[1] - rightValue[1] ||
    leftValue[2].localeCompare(rightValue[2])
  );
}

function isFiniteTime(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getRunwayEventTime(flight: ReplayFlight): number | null {
  if (flight.operation === "departure") {
    return isFiniteTime(flight.departureTime) ? flight.departureTime : flight.firstTime;
  }

  if (flight.operation === "arrival") {
    if (isFiniteTime(flight.lastEventTime)) {
      return flight.lastEventTime;
    }
    if (isFiniteTime(flight.arrivalTime)) {
      return flight.arrivalTime;
    }
    return flight.lastTime;
  }

  return null;
}

function buildRunwayTimelineRows(
  flights: ReplayFlight[],
  replayMinTime: number,
  replayMaxTime: number,
): RunwayTimelineRow[] {
  const rowMap = new Map<string, RunwayOccupancy[]>();

  for (const flight of flights) {
    if (flight.operation !== "departure" && flight.operation !== "arrival") {
      continue;
    }

    const runway = normalizeRunwayName(flight.runway);
    const eventTime = getRunwayEventTime(flight);
    if (!runway || eventTime === null) {
      continue;
    }

    const durationSeconds =
      flight.operation === "departure"
        ? DEPARTURE_RUNWAY_OCCUPANCY_SECONDS
        : ARRIVAL_RUNWAY_OCCUPANCY_SECONDS;
    const startTime = eventTime;
    const endTime = eventTime + durationSeconds;
    if (endTime < replayMinTime || startTime > replayMaxTime) {
      continue;
    }

    const occupancy: RunwayOccupancy = {
      id: `${flight.id}:${flight.operation}:${eventTime}`,
      flight,
      runway,
      operation: flight.operation,
      startTime,
      endTime,
    };
    rowMap.set(runway, [...(rowMap.get(runway) ?? []), occupancy]);
  }

  return [...rowMap.entries()]
    .sort(([leftRunway], [rightRunway]) => compareRunways(leftRunway, rightRunway))
    .map(([runway, occupancies]) => ({
      runway,
      occupancies: occupancies.sort(
        (left, right) =>
          left.startTime - right.startTime ||
          left.flight.callsign.localeCompare(right.flight.callsign),
      ),
    }));
}

function padTimePart(value: number): string {
  return String(value).padStart(2, "0");
}

function formatUtcTime(epochSeconds: number, includeSeconds = false): string {
  const date = new Date(epochSeconds * 1000);
  const hours = padTimePart(date.getUTCHours());
  const minutes = padTimePart(date.getUTCMinutes());
  if (!includeSeconds) {
    return `${hours}:${minutes}`;
  }

  return `${hours}:${minutes}:${padTimePart(date.getUTCSeconds())}`;
}

function getTickInterval(secondsPerPixel: number): number {
  const targetSeconds = secondsPerPixel * TICK_TARGET_WIDTH;
  return (
    TICK_INTERVAL_SECONDS.find((intervalSeconds) => intervalSeconds >= targetSeconds) ??
    TICK_INTERVAL_SECONDS[TICK_INTERVAL_SECONDS.length - 1]
  );
}

function buildTickTimes(startTime: number, endTime: number, secondsPerPixel: number): number[] {
  const intervalSeconds = getTickInterval(secondsPerPixel);
  const firstTick = Math.ceil(startTime / intervalSeconds) * intervalSeconds;
  const ticks: number[] = [];

  for (let tickTime = firstTick; tickTime <= endTime; tickTime += intervalSeconds) {
    ticks.push(tickTime);
  }

  return ticks;
}

function buildOccupancyTooltip(occupancy: RunwayOccupancy): string {
  const flightNumber = occupancy.flight.callsign || occupancy.flight.id;
  const fixSequence = occupancy.flight.fixSequence ?? occupancy.flight.originalFixSequence;
  if (!fixSequence?.length) {
    return flightNumber;
  }

  return `${flightNumber}\n${fixSequence.join(" > ")}`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeOverlapOperation(value: unknown): "departure" | "arrival" | null {
  const normalized = readString(value)?.toLowerCase();
  return normalized === "departure" || normalized === "arrival" ? normalized : null;
}

function normalizeOverlapUse(value: unknown): RunwayOverlapUse | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const rawUse = value as Record<string, unknown>;
  const operation = normalizeOverlapOperation(rawUse.operation);
  const flightId = readString(rawUse.flight_id);
  const flightNumber = readString(rawUse.flight_number) ?? flightId;

  if (!operation || !flightId || !flightNumber) {
    return null;
  }

  return {
    flightNumber,
    icao24: readString(rawUse.icao24),
    flightId,
    operation,
    runway: readString(rawUse.runway),
  };
}

function normalizeRunwayOverlap(value: unknown, index: number): RunwayOverlap | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const rawOverlap = value as Record<string, unknown>;
  const runway = readString(rawOverlap.runway);
  const useA = normalizeOverlapUse(rawOverlap.use_a);
  const useB = normalizeOverlapUse(rawOverlap.use_b);
  const startTime = readNumber(rawOverlap.start_time);
  const endTime = readNumber(rawOverlap.end_time);
  const overlappingTime = readNumber(rawOverlap.overlapping_time) ?? startTime;
  const overlappingDuration = readNumber(rawOverlap.overlapping_duration);

  if (
    !runway ||
    !useA ||
    !useB ||
    startTime === undefined ||
    endTime === undefined ||
    overlappingTime === undefined ||
    overlappingDuration === undefined
  ) {
    return null;
  }

  return {
    id: `${runway}:${useA.flightId}:${useB.flightId}:${overlappingTime}:${index}`,
    runway,
    useA,
    useB,
    startTime,
    endTime,
    overlappingTime,
    overlappingTimeUtc: readString(rawOverlap.overlapping_time_utc),
    overlappingDuration,
  };
}

function normalizeRunwayOverlaps(payload: unknown): RunwayOverlap[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((value, index) => normalizeRunwayOverlap(value, index))
    .filter((overlap): overlap is RunwayOverlap => overlap !== null)
    .sort(
      (left, right) =>
        left.overlappingTime - right.overlappingTime ||
        left.runway.localeCompare(right.runway) ||
        left.useA.flightNumber.localeCompare(right.useA.flightNumber),
    );
}

function formatOverlapDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function formatOperationLabel(operation: RunwayOverlapUse["operation"]): string {
  return operation === "arrival" ? "ARR" : "DEP";
}

function getOverlapInteractionType(overlap: RunwayOverlap): RunwayOverlapInteraction {
  return `${formatOperationLabel(overlap.useA.operation)}-${formatOperationLabel(overlap.useB.operation)}` as RunwayOverlapInteraction;
}

function buildOverlapTooltip(overlap: RunwayOverlap): string {
  return [
    `${overlap.runway} ${formatUtcTime(overlap.overlappingTime, true)}`,
    `${overlap.useA.flightNumber} ${formatOperationLabel(overlap.useA.operation)} ${overlap.useA.runway ?? ""}`.trim(),
    `${overlap.useB.flightNumber} ${formatOperationLabel(overlap.useB.operation)} ${overlap.useB.runway ?? ""}`.trim(),
    formatOverlapDuration(overlap.overlappingDuration),
  ].join("\n");
}

function getOverlapRunways(overlap: RunwayOverlap): string[] {
  return [
    normalizeRunwayName(overlap.runway),
    normalizeRunwayName(overlap.useA.runway),
    normalizeRunwayName(overlap.useB.runway),
  ].filter((runway): runway is string => runway !== null);
}

function overlapMatchesFlightQuery(overlap: RunwayOverlap, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  return [overlap.useA, overlap.useB].some((use) =>
    [use.flightNumber, use.flightId, use.icao24 ?? ""].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    ),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function RunwayUseTimeline({
  replayMode,
  flights,
  replayTime,
  replayMinTime,
  replayMaxTime,
  replayLoading,
  runwayUseTimelineRequestToken,
  onReplayTimeChange,
  onOccupancySelect,
}: RunwayUseTimelineProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const overlapRequestIdRef = useRef(0);
  const [scaleIndex, setScaleIndex] = useState(DEFAULT_TEMPORAL_SCALE_INDEX);
  const [dragging, setDragging] = useState(false);
  const [overlapsOpen, setOverlapsOpen] = useState(false);
  const [dismissedRunwayUseRequestToken, setDismissedRunwayUseRequestToken] = useState<number | undefined>(undefined);
  const [overlaps, setOverlaps] = useState<RunwayOverlap[]>([]);
  const [overlapsLoading, setOverlapsLoading] = useState(false);
  const [overlapsError, setOverlapsError] = useState<string | null>(null);
  const [overlapFlightQuery, setOverlapFlightQuery] = useState("");
  const [overlapRunwayFilter, setOverlapRunwayFilter] = useState("");
  const [overlapInteractionFilter, setOverlapInteractionFilter] = useState("");
  const [overlapDurationFilters, setOverlapDurationFilters] = useState<number[]>([]);
  const secondsPerPixel = TEMPORAL_SCALE_SECONDS_PER_PIXEL[scaleIndex];
  const replayReady = !replayLoading && replayMaxTime > replayMinTime;
  const timelineStart = Math.floor(replayMinTime);
  const timelineEnd = Math.ceil(replayMaxTime);
  const timelineDuration = Math.max(1, timelineEnd - timelineStart);
  const timelineWidth = Math.max(MIN_TIMELINE_WIDTH, Math.ceil(timelineDuration / secondsPerPixel));
  const contentWidth = RUNWAY_LABEL_WIDTH + timelineWidth;
  const clampedReplayTime = clamp(replayTime || replayMinTime, replayMinTime, replayMaxTime);
  const seekerLeft = RUNWAY_LABEL_WIDTH + (clampedReplayTime - timelineStart) / secondsPerPixel;
  const rows = useMemo(
    () => buildRunwayTimelineRows(flights, replayMinTime, replayMaxTime),
    [flights, replayMaxTime, replayMinTime],
  );
  const tickTimes = useMemo(
    () => buildTickTimes(timelineStart, timelineEnd, secondsPerPixel),
    [secondsPerPixel, timelineEnd, timelineStart],
  );
  const tickLabelsIncludeSeconds = getTickInterval(secondsPerPixel) < 300;
  // Runway overlaps are scenario-manager evaluations, so this control is intentionally hidden for ADS-B replay.
  const showRunwayOverlaps = replayMode === "simulation";
  const activeRunwayUseRequest =
    showRunwayOverlaps &&
    runwayUseTimelineRequestToken !== undefined &&
    runwayUseTimelineRequestToken !== dismissedRunwayUseRequestToken;
  const runwayOverlapsOpen = showRunwayOverlaps && (overlapsOpen || activeRunwayUseRequest);
  const overlapRunwayOptions = useMemo(
    () =>
      [...new Set(overlaps.flatMap(getOverlapRunways))]
        .sort(compareRunways),
    [overlaps],
  );
  const filteredOverlaps = useMemo(() => {
    const normalizedQuery = overlapFlightQuery.trim().toLowerCase();

    return overlaps.filter((overlap) => {
      const matchesFlight = overlapMatchesFlightQuery(overlap, normalizedQuery);
      const matchesRunway =
        !overlapRunwayFilter || getOverlapRunways(overlap).includes(overlapRunwayFilter);
      const matchesInteraction =
        !overlapInteractionFilter || getOverlapInteractionType(overlap) === overlapInteractionFilter;
      const matchesDuration =
        overlapDurationFilters.length === 0 ||
        overlapDurationFilters.some((limitSeconds) => overlap.overlappingDuration < limitSeconds);

      return matchesFlight && matchesRunway && matchesInteraction && matchesDuration;
    });
  }, [overlapDurationFilters, overlapFlightQuery, overlapInteractionFilter, overlapRunwayFilter, overlaps]);

  const getTimeFromClientX = (clientX: number) => {
    const contentRect = contentRef.current?.getBoundingClientRect();
    if (!contentRect) {
      return clampedReplayTime;
    }

    const timelineX = clamp(clientX - contentRect.left - RUNWAY_LABEL_WIDTH, 0, timelineWidth);
    return clamp(Math.round(timelineStart + timelineX * secondsPerPixel), replayMinTime, replayMaxTime);
  };

  const fetchRunwayOverlaps = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/tools/evals/runway-overlaps", { cache: "no-store", signal });
    if (!response.ok) {
      throw new Error(`Failed to load runway overlaps (${response.status})`);
    }

    return normalizeRunwayOverlaps(await response.json());
  }, []);

  const loadRunwayOverlaps = useCallback(async () => {
    const requestId = overlapRequestIdRef.current + 1;
    overlapRequestIdRef.current = requestId;
    setOverlapsLoading(true);
    setOverlapsError(null);

    try {
      const nextOverlaps = await fetchRunwayOverlaps();
      if (overlapRequestIdRef.current === requestId) {
        setOverlaps(nextOverlaps);
      }
    } catch (error) {
      if (overlapRequestIdRef.current === requestId) {
        setOverlaps([]);
        setOverlapsError(error instanceof Error ? error.message : "Failed to load runway overlaps");
      }
    } finally {
      if (overlapRequestIdRef.current === requestId) {
        setOverlapsLoading(false);
      }
    }
  }, [fetchRunwayOverlaps]);

  const toggleRunwayOverlaps = () => {
    if (!showRunwayOverlaps) {
      return;
    }

    const nextOpen = !runwayOverlapsOpen;
    if (!nextOpen) {
      setDismissedRunwayUseRequestToken(runwayUseTimelineRequestToken);
    }
    setOverlapsOpen(nextOpen);
    if (nextOpen) {
      setDismissedRunwayUseRequestToken(undefined);
      void loadRunwayOverlaps();
    }
  };

  const toggleOverlapDurationFilter = (limitSeconds: number) => {
    setOverlapDurationFilters((currentFilters) =>
      currentFilters.includes(limitSeconds)
        ? currentFilters.filter((currentLimit) => currentLimit !== limitSeconds)
        : [...currentFilters, limitSeconds].sort((left, right) => left - right),
    );
  };

  useEffect(() => {
    if (runwayUseTimelineRequestToken === undefined) {
      return;
    }

    if (!showRunwayOverlaps) {
      return;
    }

    const requestId = overlapRequestIdRef.current + 1;
    const controller = new AbortController();
    overlapRequestIdRef.current = requestId;

    async function loadRequestedRunwayOverlaps() {
      setOverlapsLoading(true);
      setOverlapsError(null);

      try {
        const nextOverlaps = await fetchRunwayOverlaps(controller.signal);
        if (overlapRequestIdRef.current === requestId && !controller.signal.aborted) {
          setOverlaps(nextOverlaps);
        }
      } catch (error) {
        if (overlapRequestIdRef.current === requestId && !controller.signal.aborted) {
          setOverlaps([]);
          setOverlapsError(error instanceof Error ? error.message : "Failed to load runway overlaps");
        }
      } finally {
        if (overlapRequestIdRef.current === requestId && !controller.signal.aborted) {
          setOverlapsLoading(false);
        }
      }
    }

    void loadRequestedRunwayOverlaps();
    return () => controller.abort();
  }, [fetchRunwayOverlaps, runwayUseTimelineRequestToken, showRunwayOverlaps]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || dragging) {
      return;
    }

    const visibleStart = frame.scrollLeft;
    const visibleEnd = visibleStart + frame.clientWidth;
    const leftEdge = visibleStart + RUNWAY_LABEL_WIDTH + 28;
    const rightEdge = visibleEnd - 42;
    if (seekerLeft < leftEdge || seekerLeft > rightEdge) {
      frame.scrollLeft = Math.max(0, seekerLeft - frame.clientWidth / 2);
    }
  }, [dragging, seekerLeft, timelineWidth]);

  const setReplayTimeFromPointer = (clientX: number) => {
    if (!replayReady || !onReplayTimeChange) {
      return;
    }

    onReplayTimeChange(getTimeFromClientX(clientX));
  };

  const handleSeekerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!replayReady) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setReplayTimeFromPointer(event.clientX);
  };

  const handleSeekerPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) {
      return;
    }

    setReplayTimeFromPointer(event.clientX);
  };

  const handleSeekerPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const handleFrameClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-runway-occupancy]") || target.closest(".runway-timeline-seeker")) {
      return;
    }

    setReplayTimeFromPointer(event.clientX);
  };

  const handleSeekerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!replayReady || !onReplayTimeChange) {
      return;
    }

    const stepSeconds = event.shiftKey ? 300 : 60;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onReplayTimeChange(clamp(clampedReplayTime - stepSeconds, replayMinTime, replayMaxTime));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onReplayTimeChange(clamp(clampedReplayTime + stepSeconds, replayMinTime, replayMaxTime));
    } else if (event.key === "Home") {
      event.preventDefault();
      onReplayTimeChange(replayMinTime);
    } else if (event.key === "End") {
      event.preventDefault();
      onReplayTimeChange(replayMaxTime);
    }
  };

  return (
    <section className="runway-use-timeline" aria-label="Runway use timeline">
      <div className="runway-timeline-toolbar">
        {showRunwayOverlaps ? (
          <button
            type="button"
            className="view-opt-btn runway-overlaps-toggle"
            aria-label="Show runway overlaps"
            aria-pressed={runwayOverlapsOpen}
            title="Show runway overlaps"
            onClick={toggleRunwayOverlaps}
          >
            <GitCompareArrows aria-hidden="true" />
          </button>
        ) : null}
        <div className="runway-timeline-scale" data-runway-scale>
          <SlidersHorizontal aria-hidden="true" />
          <input
            type="range"
            min={0}
            max={TEMPORAL_SCALE_SECONDS_PER_PIXEL.length - 1}
            step={1}
            value={scaleIndex}
            aria-label="Runway timeline temporal scale"
            title={`${secondsPerPixel}s/px`}
            disabled={!replayReady}
            onChange={(event) => setScaleIndex(Number(event.currentTarget.value))}
          />
        </div>
      </div>

      <div className={`runway-timeline-body${runwayOverlapsOpen ? " runway-timeline-body-with-overlaps" : ""}`}>
        <div className="runway-timeline-frame" ref={frameRef} onClick={handleFrameClick}>
          <div className="runway-timeline-content" ref={contentRef} style={{ width: contentWidth }}>
            <div className="runway-timeline-tick-row" style={{ width: contentWidth }}>
              <div className="runway-timeline-label-spacer" />
              <div className="runway-timeline-tick-track" style={{ width: timelineWidth }}>
                {tickTimes.map((tickTime) => (
                  <div
                    className="runway-timeline-tick"
                    key={tickTime}
                    style={{ left: (tickTime - timelineStart) / secondsPerPixel }}
                  >
                    <span>{formatUtcTime(tickTime, tickLabelsIncludeSeconds)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="runway-timeline-row-list" style={{ width: contentWidth }}>
              {!replayReady ? (
                <div className="runway-timeline-empty">No data</div>
              ) : rows.length === 0 ? (
                <div className="runway-timeline-empty">No runway events</div>
              ) : (
                rows.map((row) => (
                  <div className="runway-timeline-row" key={row.runway} style={{ height: ROW_HEIGHT }}>
                    <div className="runway-timeline-row-label">{row.runway}</div>
                    <div className="runway-timeline-row-track" style={{ width: timelineWidth }}>
                      {row.occupancies.map((occupancy) => {
                        const visibleStart = Math.max(occupancy.startTime, timelineStart);
                        const visibleEnd = Math.min(occupancy.endTime, timelineEnd);
                        const occupancyLeft = (visibleStart - timelineStart) / secondsPerPixel;
                        const occupancyWidth = Math.max(5, (visibleEnd - visibleStart) / secondsPerPixel);
                        const tooltip = buildOccupancyTooltip(occupancy);

                        return (
                          <button
                            type="button"
                            className={`runway-occupancy runway-occupancy-${occupancy.operation}`}
                            data-runway-occupancy
                            key={occupancy.id}
                            style={{ left: occupancyLeft, width: occupancyWidth }}
                            title={tooltip}
                            aria-label={tooltip.replace(/\n/g, ", ")}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              const selectedTime = clamp(
                                getTimeFromClientX(event.clientX),
                                occupancy.startTime,
                                occupancy.endTime,
                              );
                              onOccupancySelect?.(occupancy.flight.id, selectedTime);
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {replayReady ? (
              <div
                className={`runway-timeline-seeker${dragging ? " is-dragging" : ""}`}
                role="slider"
                tabIndex={0}
                aria-label="Replay time seeker"
                aria-valuemin={Math.floor(replayMinTime)}
                aria-valuemax={Math.ceil(replayMaxTime)}
                aria-valuenow={Math.floor(clampedReplayTime)}
                aria-valuetext={formatUtcTime(clampedReplayTime, true)}
                style={{ left: seekerLeft }}
                onPointerDown={handleSeekerPointerDown}
                onPointerMove={handleSeekerPointerMove}
                onPointerUp={handleSeekerPointerUp}
                onPointerCancel={handleSeekerPointerUp}
                onKeyDown={handleSeekerKeyDown}
              >
                <span className="runway-timeline-seeker-time">{formatUtcTime(clampedReplayTime, true)}</span>
                <span className="runway-timeline-seeker-line" aria-hidden="true" />
              </div>
            ) : null}
          </div>
        </div>

        {runwayOverlapsOpen ? (
          <aside className="runway-overlaps-panel" aria-label="Runway overlaps">
            {overlapsLoading ? <div className="runway-overlaps-status">Loading</div> : null}
            {!overlapsLoading && overlapsError ? (
              <button type="button" className="runway-overlaps-status-button" onClick={() => void loadRunwayOverlaps()}>
                Retry
              </button>
            ) : null}
            {!overlapsLoading && !overlapsError && overlaps.length === 0 ? (
              <div className="runway-overlaps-status">No overlaps</div>
            ) : null}
            {!overlapsLoading && !overlapsError && overlaps.length > 0 ? (
              <>
                <div className="runway-overlap-filters" role="search" aria-label="Filter runway overlaps">
                  <label className="runway-overlap-filter-field runway-overlap-filter-search">
                    <span>Flight</span>
                    <input
                      type="search"
                      value={overlapFlightQuery}
                      aria-label="Search runway overlap flights"
                      placeholder="Search flight"
                      onChange={(event) => setOverlapFlightQuery(event.currentTarget.value)}
                    />
                  </label>
                  <label className="runway-overlap-filter-field">
                    <span>Runway</span>
                    <select
                      value={overlapRunwayFilter}
                      aria-label="Filter runway overlaps by runway"
                      onChange={(event) => setOverlapRunwayFilter(event.currentTarget.value)}
                    >
                      <option value="">All</option>
                      {overlapRunwayOptions.map((runway) => (
                        <option key={runway} value={runway}>
                          {runway}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="runway-overlap-filter-field">
                    <span>Type</span>
                    <select
                      value={overlapInteractionFilter}
                      aria-label="Filter runway overlaps by interaction type"
                      onChange={(event) => setOverlapInteractionFilter(event.currentTarget.value)}
                    >
                      <option value="">All</option>
                      {OVERLAP_INTERACTION_FILTER_OPTIONS.map((interactionType) => (
                        <option key={interactionType} value={interactionType}>
                          {interactionType}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset className="runway-overlap-duration-filters">
                    <legend>Duration</legend>
                    <div>
                      {OVERLAP_DURATION_FILTER_OPTIONS.map((limitSeconds) => (
                        <label key={limitSeconds} className="runway-overlap-duration-filter">
                          <input
                            type="checkbox"
                            checked={overlapDurationFilters.includes(limitSeconds)}
                            onChange={() => toggleOverlapDurationFilter(limitSeconds)}
                          />
                          <span>&lt;{limitSeconds}s</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
                {filteredOverlaps.length !== overlaps.length ? (
                  <div className="runway-overlap-filter-result-count">
                    Showing {filteredOverlaps.length} of {overlaps.length}
                  </div>
                ) : null}
                {filteredOverlaps.length > 0 ? (
                  <div className="runway-overlap-list">
                    {filteredOverlaps.map((overlap) => {
                      const active = clampedReplayTime >= overlap.startTime && clampedReplayTime <= overlap.endTime;
                      const tooltip = buildOverlapTooltip(overlap);

                      return (
                        <button
                          type="button"
                          className="runway-overlap-item"
                          aria-current={active ? "time" : undefined}
                          title={tooltip}
                          key={overlap.id}
                          onClick={() => onReplayTimeChange?.(overlap.overlappingTime)}
                        >
                          <span className="runway-overlap-time">{formatUtcTime(overlap.overlappingTime, true)}</span>
                          <span className="runway-overlap-runway">{overlap.runway}</span>
                          <span className="runway-overlap-pair">
                            <strong>{overlap.useA.flightNumber}</strong>
                            <span>{formatOperationLabel(overlap.useA.operation)}</span>
                            <strong>{overlap.useB.flightNumber}</strong>
                            <span>{formatOperationLabel(overlap.useB.operation)}</span>
                          </span>
                          <span className="runway-overlap-duration">
                            {formatOverlapDuration(overlap.overlappingDuration)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="runway-overlaps-status">No overlaps match the current filters</div>
                )}
              </>
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
