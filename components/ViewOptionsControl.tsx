"use client";

import type { FlightAltitudeRange } from "@/components/adsb-replay/flight-altitude-filter";
import type { ReplayMode } from "@/components/adsb-replay/types";
import type { FlightOperationVisibility } from "@/components/adsb-replay/flight-line-colors";
import FixViewToggleButton from "@/components/view-options/FixViewToggleButton";
import LinkViewToggleButton from "@/components/view-options/LinkViewToggleButton";
import ReplayControls from "@/components/view-options/ReplayControls";
import RulerToggleButton from "@/components/view-options/RulerToggleButton";

type ViewOptionsControlProps = {
  showLinks: boolean;
  onToggleLinks: () => void;
  showWaypoints: boolean;
  onToggleWaypoints: () => void;
  rulerActive?: boolean;
  onToggleRuler?: () => void;
  replayMode?: ReplayMode;
  replayTime?: number;
  replayMinTime?: number;
  replayMaxTime?: number;
  replayPlaying?: boolean;
  replaySpeed?: number;
  replayLoading?: boolean;
  flightAltitudeRange?: FlightAltitudeRange;
  flightOperationVisibility?: FlightOperationVisibility;
  onReplayTimeChange?: (time: number) => void;
  onToggleReplayPlaying?: () => void;
  onReplaySpeedChange?: (speed: number) => void;
  onFlightAltitudeRangeChange?: (altitudeRange: FlightAltitudeRange) => void;
  onFlightOperationVisibilityChange?: (visibility: FlightOperationVisibility) => void;
};

export default function ViewOptionsControl({
  showLinks,
  onToggleLinks,
  showWaypoints,
  onToggleWaypoints,
  rulerActive = false,
  onToggleRuler,
  replayMode = "simulation",
  replayTime = 0,
  replayMinTime = 0,
  replayMaxTime = 24 * 60 * 60 - 1,
  replayPlaying = false,
  replaySpeed = 1,
  replayLoading = false,
  flightAltitudeRange,
  flightOperationVisibility,
  onReplayTimeChange,
  onToggleReplayPlaying,
  onReplaySpeedChange,
  onFlightAltitudeRangeChange,
  onFlightOperationVisibilityChange,
}: ViewOptionsControlProps) {
  return (
    <section className="view-options" aria-label="View options">
      <ReplayControls
        replayMode={replayMode}
        replayTime={replayTime}
        replayMinTime={replayMinTime}
        replayMaxTime={replayMaxTime}
        replayPlaying={replayPlaying}
        replaySpeed={replaySpeed}
        replayLoading={replayLoading}
        flightAltitudeRange={flightAltitudeRange}
        flightOperationVisibility={flightOperationVisibility}
        onReplayTimeChange={onReplayTimeChange}
        onToggleReplayPlaying={onToggleReplayPlaying}
        onReplaySpeedChange={onReplaySpeedChange}
        onFlightAltitudeRangeChange={onFlightAltitudeRangeChange}
        onFlightOperationVisibilityChange={onFlightOperationVisibilityChange}
      />

      <LinkViewToggleButton showLinks={showLinks} onToggleLinks={onToggleLinks} />
      <FixViewToggleButton showWaypoints={showWaypoints} onToggleWaypoints={onToggleWaypoints} />
      <RulerToggleButton rulerActive={rulerActive} onToggleRuler={onToggleRuler} />
    </section>
  );
}
