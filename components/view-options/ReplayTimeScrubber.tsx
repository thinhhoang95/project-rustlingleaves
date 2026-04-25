"use client";

type ReplayTimeScrubberProps = {
  replayTime: number;
  replayMinTime: number;
  replayMaxTime: number;
  replayLoading: boolean;
  onReplayTimeChange?: (time: number) => void;
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
  replayTime,
  replayMinTime,
  replayMaxTime,
  replayLoading,
  onReplayTimeChange,
}: ReplayTimeScrubberProps) {
  const replayReady = !replayLoading && replayMaxTime > replayMinTime;
  const clampedReplayTime = Math.floor(Math.max(replayMinTime, Math.min(replayMaxTime, replayTime)));

  return (
    <div className="replay-scrubber">
      <input
        type="range"
        min={Math.floor(replayMinTime)}
        max={Math.floor(replayMaxTime)}
        step={1}
        value={clampedReplayTime}
        aria-label="ADS-B replay time of day"
        disabled={!replayReady}
        onChange={(event) => onReplayTimeChange?.(Number(event.currentTarget.value))}
      />
      <span className="replay-time">{replayReady ? formatTimeOfDay(replayTime) : "Loading"}</span>
    </div>
  );
}
