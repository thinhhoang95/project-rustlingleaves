"use client";

type ReplaySpeedSelectorProps = {
  replaySpeed: number;
  disabled: boolean;
  onReplaySpeedChange?: (speed: number) => void;
};

const REPLAY_SPEEDS = [1, 2, 5, 10];

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
          disabled={disabled}
          onClick={() => onReplaySpeedChange?.(speed)}
        >
          {speed}x
        </button>
      ))}
    </div>
  );
}
