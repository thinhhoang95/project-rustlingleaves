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
import { useReplayControlShortcuts } from "@/components/view-options/replay-control-shortcuts";

type ReplayControlsProps = {
  replayMode?: ReplayMode;
  replayTime?: number;
  replayMinTime?: number;
  replayMaxTime?: number;
  replayPlaying?: boolean;
  replaySpeed?: number;
  replayLoading?: boolean;
  replayFlights?: ReplayFlight[];
  runwayUseTimelineRequestToken?: number;
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
  runwayUseTimelineRequestToken,
  flightAltitudeRange,
  flightOperationVisibility,
  onReplayTimeChange,
  onRunwayOccupancySelect,
  onToggleReplayPlaying,
  onReplaySpeedChange,
  onFlightAltitudeRangeChange,
  onFlightOperationVisibilityChange,
}: ReplayControlsProps) {
  const [manualRunwayTimelineOpen, setManualRunwayTimelineOpen] = useState(false);
  const [dismissedRunwayUseRequestToken, setDismissedRunwayUseRequestToken] = useState<number | undefined>(undefined);
  const [flightOperationFilterOpen, setFlightOperationFilterOpen] = useState(false);
  const [altitudeFilterOpen, setAltitudeFilterOpen] = useState(false);
  const showReplayControls = Boolean(onReplayTimeChange);
  const replayReady = !replayLoading && replayMaxTime > replayMinTime;
  const replayLabel = replayMode === "simulation" ? "Simulation" : "ADS-B";
  const showFlightOperationFilter = Boolean(flightOperationVisibility && onFlightOperationVisibilityChange);
  const showAltitudeFilter = Boolean(flightAltitudeRange && onFlightAltitudeRangeChange);
  const activeRunwayUseRequest =
    replayMode === "simulation" &&
    runwayUseTimelineRequestToken !== undefined &&
    runwayUseTimelineRequestToken > 0 &&
    runwayUseTimelineRequestToken !== dismissedRunwayUseRequestToken;
  const runwayTimelineOpen = manualRunwayTimelineOpen || activeRunwayUseRequest;
  const runwayOverlapRequestToken = activeRunwayUseRequest ? runwayUseTimelineRequestToken : undefined;
  const toggleRunwayTimeline = () => {
    if (runwayTimelineOpen) {
      setDismissedRunwayUseRequestToken(runwayUseTimelineRequestToken);
      setManualRunwayTimelineOpen(false);
      return;
    }

    setManualRunwayTimelineOpen(true);
  };

  useReplayControlShortcuts({
    replayReady,
    replayTime,
    replayMinTime,
    replayMaxTime,
    onReplayTimeChange: showReplayControls ? onReplayTimeChange : undefined,
    onToggleReplayPlaying: showReplayControls ? onToggleReplayPlaying : undefined,
    onReplaySpeedChange: showReplayControls ? onReplaySpeedChange : undefined,
    onToggleRunwayTimeline: showReplayControls && replayReady ? toggleRunwayTimeline : undefined,
    onToggleFlightOperationFilter: showReplayControls && showFlightOperationFilter
      ? () => setFlightOperationFilterOpen((open) => !open)
      : undefined,
    onToggleAltitudeFilter:
      showReplayControls && showAltitudeFilter ? () => setAltitudeFilterOpen((open) => !open) : undefined,
  });

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
        runwayUseTimelineRequestToken={runwayOverlapRequestToken}
        onReplayTimeChange={onReplayTimeChange}
        onToggleRunwayTimeline={toggleRunwayTimeline}
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
          menuOpen={flightOperationFilterOpen}
          onMenuOpenChange={setFlightOperationFilterOpen}
          onVisibilityChange={onFlightOperationVisibilityChange}
        />
      ) : null}
      {flightAltitudeRange && onFlightAltitudeRangeChange ? (
        <ReplayAltitudeRangeFilter
          altitudeRange={flightAltitudeRange}
          menuOpen={altitudeFilterOpen}
          onMenuOpenChange={setAltitudeFilterOpen}
          onAltitudeRangeChange={onFlightAltitudeRangeChange}
        />
      ) : null}
    </div>
  );
}
