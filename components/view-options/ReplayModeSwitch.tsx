"use client";

import type { ReplayMode } from "@/components/adsb-replay/types";

type ReplayModeSwitchProps = {
  replayMode: ReplayMode;
  onReplayModeChange: (mode: ReplayMode) => void;
};

export default function ReplayModeSwitch({ replayMode, onReplayModeChange }: ReplayModeSwitchProps) {
  return (
    <div className="mode-switch" role="group" aria-label="Replay mode">
      <button
        type="button"
        className="mode-switch-button"
        aria-pressed={replayMode === "simulation"}
        onClick={() => onReplayModeChange("simulation")}
      >
        Simulation
      </button>
      <button
        type="button"
        className="mode-switch-button"
        aria-pressed={replayMode === "adsb"}
        onClick={() => onReplayModeChange("adsb")}
      >
        ADS-B
      </button>
    </div>
  );
}
