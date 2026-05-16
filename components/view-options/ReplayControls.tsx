"use client";

import { useState } from "react";
import type { ReplayFlight, ReplayMode } from "@/components/adsb-replay/types";
import type { FlightAltitudeRange } from "@/components/adsb-replay/flight-altitude-filter";
import type { FlightOperationVisibility } from "@/components/adsb-replay/flight-line-colors";
import { FlightOperationFilterMenuButton } from "@/components/TimeScrubberPopover";
import ReplayAltitudeRangeFilter from "@/components/view-options/ReplayAltitudeRangeFilter";
import ReplayPlayPauseButton from "@/components/view-options/ReplayPlayPauseButton";
import ReplaySpeedSelector from "@/components/view-options/ReplaySpeedSelector";
import ReplayTimeScrubber from "@/components/view-options/ReplayTimeScrubber";

type ReplayControlsProps = {
  replayMode?: ReplayMode;
  replayTime?: number;
  replayMinTime?: number;
  replayMaxTime?: number;
  replayPlaying?: boolean;
  replaySpeed?: number;
  replayLoading?: boolean;
  replayFlights?: ReplayFlight[];
  flightAltitudeRange?: FlightAltitudeRange;
  flightOperationVisibility?: FlightOperationVisibility;
  onReplayTimeChange?: (time: number) => void;
  onRunwayOccupancySelect?: (flightId: string, time: number) => void;
  onToggleReplayPlaying?: () => void;
  onReplaySpeedChange?: (speed: number) => void;
  onFlightAltitudeRangeChange?: (altitudeRange: FlightAltitudeRange) => void;
  onFlightOperationVisibilityChange?: (visibility: FlightOperationVisibility) => void;
};

export default function ReplayControls({
  replayMode = "simulation",
  replayTime = 0,
  replayMinTime = 0,
  replayMaxTime = 24 * 60 * 60 - 1,
  replayPlaying = false,
  replaySpeed = 20,
  replayLoading = false,
  replayFlights = [],
  flightAltitudeRange,
  flightOperationVisibility,
  onReplayTimeChange,
  onRunwayOccupancySelect,
  onToggleReplayPlaying,
  onReplaySpeedChange,
  onFlightAltitudeRangeChange,
  onFlightOperationVisibilityChange,
}: ReplayControlsProps) {
  const [runwayTimelineOpen, setRunwayTimelineOpen] = useState(false);
  const showReplayControls = onReplayTimeChange;
  const replayReady = !replayLoading && replayMaxTime > replayMinTime;
  const replayLabel = replayMode === "simulation" ? "Simulation" : "ADS-B";

  if (!showReplayControls) {
    return null;
  }

  return (
    <div className="replay-controls" aria-label={`${replayLabel} replay controls`}>
      <ReplayPlayPauseButton
        replayMode={replayMode}
        replayPlaying={replayPlaying}
        disabled={!replayReady}
        onToggle={onToggleReplayPlaying}
      />
      <ReplayTimeScrubber
        replayMode={replayMode}
        replayTime={replayTime}
        replayMinTime={replayMinTime}
        replayMaxTime={replayMaxTime}
        replayLoading={replayLoading}
        replayFlights={replayFlights}
        runwayTimelineOpen={runwayTimelineOpen}
        onReplayTimeChange={onReplayTimeChange}
        onToggleRunwayTimeline={() => setRunwayTimelineOpen((open) => !open)}
        onRunwayOccupancySelect={onRunwayOccupancySelect}
      />
      <ReplaySpeedSelector
        replaySpeed={replaySpeed}
        disabled={!replayReady}
        onReplaySpeedChange={onReplaySpeedChange}
      />
      {flightOperationVisibility && onFlightOperationVisibilityChange ? (
        <FlightOperationFilterMenuButton
          visibility={flightOperationVisibility}
          onVisibilityChange={onFlightOperationVisibilityChange}
        />
      ) : null}
      {flightAltitudeRange && onFlightAltitudeRangeChange ? (
        <ReplayAltitudeRangeFilter
          altitudeRange={flightAltitudeRange}
          onAltitudeRangeChange={onFlightAltitudeRangeChange}
        />
      ) : null}
    </div>
  );
}
