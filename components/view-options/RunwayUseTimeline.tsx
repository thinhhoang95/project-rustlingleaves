"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { ReplayFlight } from "@/components/adsb-replay/types";

export const DEPARTURE_RUNWAY_OCCUPANCY_SECONDS = 90;
export const ARRIVAL_RUNWAY_OCCUPANCY_SECONDS = 60;

const RUNWAY_LABEL_WIDTH = 58;
const MIN_TIMELINE_WIDTH = 640;
const ROW_HEIGHT = 30;
const TICK_TARGET_WIDTH = 112;
const TEMPORAL_SCALE_SECONDS_PER_PIXEL = [0.5, 1, 2, 3, 5, 10, 15, 30, 60, 120] as const;
const DEFAULT_TEMPORAL_SCALE_INDEX = 6;
const TICK_INTERVAL_SECONDS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 14400] as const;

type RunwayUseTimelineProps = {
  flights: ReplayFlight[];
  replayTime: number;
  replayMinTime: number;
  replayMaxTime: number;
  replayLoading: boolean;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function RunwayUseTimeline({
  flights,
  replayTime,
  replayMinTime,
  replayMaxTime,
  replayLoading,
  onReplayTimeChange,
  onOccupancySelect,
}: RunwayUseTimelineProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scaleIndex, setScaleIndex] = useState(DEFAULT_TEMPORAL_SCALE_INDEX);
  const [dragging, setDragging] = useState(false);
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

  const getTimeFromClientX = (clientX: number) => {
    const contentRect = contentRef.current?.getBoundingClientRect();
    if (!contentRect) {
      return clampedReplayTime;
    }

    const timelineX = clamp(clientX - contentRect.left - RUNWAY_LABEL_WIDTH, 0, timelineWidth);
    return clamp(Math.round(timelineStart + timelineX * secondsPerPixel), replayMinTime, replayMaxTime);
  };

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
    </section>
  );
}
