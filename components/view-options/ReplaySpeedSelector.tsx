"use client";

import { REPLAY_SPEEDS, REPLAY_SPEED_SHORTCUTS } from "@/components/view-options/replay-control-shortcuts";

type ReplaySpeedSelectorProps = {
  replaySpeed: number;
  disabled: boolean;
  onReplaySpeedChange?: (speed: number) => void;
};

export default function ReplaySpeedSelector({
  replaySpeed,
  disabled,
  onReplaySpeedChange,
}: ReplaySpeedSelectorProps) {
  return (
    <div className="replay-speed-group" role="group" aria-label="Replay speed">
      {REPLAY_SPEEDS.map((speed) => (
        <button
          key={speed}
          type="button"
          className="replay-speed-btn"
          aria-pressed={replaySpeed === speed}
          aria-keyshortcuts={REPLAY_SPEED_SHORTCUTS[speed].ariaKeyShortcuts}
          disabled={disabled}
          title={`Replay speed ${speed}x (${REPLAY_SPEED_SHORTCUTS[speed].label})`}
          onClick={() => onReplaySpeedChange?.(speed)}
        >
          {speed}x
        </button>
      ))}
    </div>
  );
}
