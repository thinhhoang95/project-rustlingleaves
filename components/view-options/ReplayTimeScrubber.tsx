"use client";

import { ChartGantt } from "lucide-react";
import type { ReplayFlight, ReplayMode } from "@/components/adsb-replay/types";
import ShimmeringText from "@/components/ShimmeringText";
import RunwayUseTimeline from "@/components/view-options/RunwayUseTimeline";
import { REPLAY_CONTROL_SHORTCUTS } from "@/components/view-options/replay-control-shortcuts";

type ReplayTimeScrubberProps = {
  replayMode: ReplayMode;
  replayTime: number;
  replayMinTime: number;
  replayMaxTime: number;
  replayLoading: boolean;
  replayFlights?: ReplayFlight[];
  runwayTimelineOpen?: boolean;
  runwayUseTimelineRequestToken?: number;
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
  runwayUseTimelineRequestToken,
  onReplayTimeChange,
  onToggleRunwayTimeline,
  onRunwayOccupancySelect,
}: ReplayTimeScrubberProps) {
  const replayReady = !replayLoading && replayMaxTime > replayMinTime;
  const clampedReplayTime = Math.floor(Math.max(replayMinTime, Math.min(replayMaxTime, replayTime)));
  const replayLabel = replayMode === "simulation" ? "simulation" : "ADS-B";
  const showRunwayTimelineToggle = Boolean(onToggleRunwayTimeline);
  const timelineShortcut = REPLAY_CONTROL_SHORTCUTS.toggleRunwayTimeline;

  return (
    <div className="replay-scrubber-shell">
      {runwayTimelineOpen ? (
        <RunwayUseTimeline
          replayMode={replayMode}
          flights={replayFlights}
          replayTime={replayTime}
          replayMinTime={replayMinTime}
          replayMaxTime={replayMaxTime}
          replayLoading={replayLoading}
          runwayUseTimelineRequestToken={runwayUseTimelineRequestToken}
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
            aria-keyshortcuts={timelineShortcut.ariaKeyShortcuts}
            aria-pressed={runwayTimelineOpen}
            title={`Runway use timeline (${timelineShortcut.label})`}
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
