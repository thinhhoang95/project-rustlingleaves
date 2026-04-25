"use client";

import type { ReplayMode } from "@/components/adsb-replay/types";
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
  onReplayTimeChange?: (time: number) => void;
  onToggleReplayPlaying?: () => void;
  onReplaySpeedChange?: (speed: number) => void;
};

export default function ReplayControls({
  replayMode = "simulation",
  replayTime = 0,
  replayMinTime = 0,
  replayMaxTime = 24 * 60 * 60 - 1,
  replayPlaying = false,
  replaySpeed = 1,
  replayLoading = false,
  onReplayTimeChange,
  onToggleReplayPlaying,
  onReplaySpeedChange,
}: ReplayControlsProps) {
  const showReplayControls = replayMode === "adsb" && onReplayTimeChange;
  const replayReady = !replayLoading && replayMaxTime > replayMinTime;

  if (!showReplayControls) {
    return null;
  }

  return (
    <div className="replay-controls" aria-label="ADS-B replay controls">
      <ReplayPlayPauseButton
        replayPlaying={replayPlaying}
        disabled={!replayReady}
        onToggle={onToggleReplayPlaying}
      />
      <ReplayTimeScrubber
        replayTime={replayTime}
        replayMinTime={replayMinTime}
        replayMaxTime={replayMaxTime}
        replayLoading={replayLoading}
        onReplayTimeChange={onReplayTimeChange}
      />
      <ReplaySpeedSelector
        replaySpeed={replaySpeed}
        disabled={!replayReady}
        onReplaySpeedChange={onReplaySpeedChange}
      />
    </div>
  );
}
