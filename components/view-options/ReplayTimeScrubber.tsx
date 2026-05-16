"use client";

import { ChartGantt } from "lucide-react";
import type { ReplayFlight, ReplayMode } from "@/components/adsb-replay/types";
import ShimmeringText from "@/components/ShimmeringText";
import RunwayUseTimeline from "@/components/view-options/RunwayUseTimeline";

type ReplayTimeScrubberProps = {
  replayMode: ReplayMode;
  replayTime: number;
  replayMinTime: number;
  replayMaxTime: number;
  replayLoading: boolean;
  replayFlights?: ReplayFlight[];
  runwayTimelineOpen?: boolean;
  onReplayTimeChange?: (time: number) => void;
  onToggleRunwayTimeline?: () => void;
  onRunwayOccupancySelect?: (flightId: string, time: number) => void;
};

function formatTimeOfDay(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export default function ReplayTimeScrubber({
  replayMode,
  replayTime,
  replayMinTime,
  replayMaxTime,
  replayLoading,
  replayFlights = [],
  runwayTimelineOpen = false,
  onReplayTimeChange,
  onToggleRunwayTimeline,
  onRunwayOccupancySelect,
}: ReplayTimeScrubberProps) {
  const replayReady = !replayLoading && replayMaxTime > replayMinTime;
  const clampedReplayTime = Math.floor(Math.max(replayMinTime, Math.min(replayMaxTime, replayTime)));
  const replayLabel = replayMode === "simulation" ? "simulation" : "ADS-B";
  const showRunwayTimelineToggle = Boolean(onToggleRunwayTimeline);

  return (
    <div className="replay-scrubber-shell">
      {runwayTimelineOpen ? (
        <RunwayUseTimeline
          flights={replayFlights}
          replayTime={replayTime}
          replayMinTime={replayMinTime}
          replayMaxTime={replayMaxTime}
          replayLoading={replayLoading}
          onReplayTimeChange={onReplayTimeChange}
          onOccupancySelect={onRunwayOccupancySelect}
        />
      ) : null}
      <div className={`replay-scrubber${showRunwayTimelineToggle ? " replay-scrubber-with-timeline" : ""}`}>
        {showRunwayTimelineToggle ? (
          <button
            type="button"
            className="view-opt-btn replay-timeline-toggle"
            aria-label="Toggle runway use timeline"
            aria-pressed={runwayTimelineOpen}
            title="Runway use timeline"
            disabled={!replayReady}
            onClick={onToggleRunwayTimeline}
          >
            <ChartGantt aria-hidden="true" />
          </button>
        ) : null}
        <input
          type="range"
          min={Math.floor(replayMinTime)}
          max={Math.floor(replayMaxTime)}
          step={1}
          value={clampedReplayTime}
          aria-label={`${replayLabel} replay time of day`}
          disabled={!replayReady}
          onChange={(event) => onReplayTimeChange?.(Number(event.currentTarget.value))}
        />
        <div className="replay-time">
          {replayReady ? formatTimeOfDay(replayTime) : null}
          {!replayReady && replayLoading ? <ShimmeringText text="Loading" className="replay-loading-text" /> : null}
          {!replayReady && !replayLoading ? "No data" : null}
        </div>
      </div>
    </div>
  );
}
