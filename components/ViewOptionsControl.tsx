"use client";

import type { ReplayMode } from "@/components/adsb-replay/types";

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
  onReplayTimeChange?: (time: number) => void;
  onToggleReplayPlaying?: () => void;
  onReplaySpeedChange?: (speed: number) => void;
};

const REPLAY_SPEEDS = [1, 2, 5, 10];

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
  onReplayTimeChange,
  onToggleReplayPlaying,
  onReplaySpeedChange,
}: ViewOptionsControlProps) {
  const showReplayControls = replayMode === "adsb" && onReplayTimeChange;
  const replayReady = !replayLoading && replayMaxTime > replayMinTime;

  return (
    <section className="view-options" aria-label="View options">
      {showReplayControls ? (
        <div className="replay-controls" aria-label="ADS-B replay controls">
          <button
            type="button"
            className="view-opt-btn replay-play-btn"
            aria-pressed={replayPlaying}
            aria-label={replayPlaying ? "Pause ADS-B replay" : "Play ADS-B replay"}
            disabled={!replayReady}
            onClick={onToggleReplayPlaying}
          >
            {replayPlaying ? (
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M6.5 4.5v11M13.5 4.5v11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M7 4.75 15 10l-8 5.25V4.75Z" fill="currentColor" />
              </svg>
            )}
          </button>

          <div className="replay-scrubber">
            <input
              type="range"
              min={Math.floor(replayMinTime)}
              max={Math.floor(replayMaxTime)}
              step={1}
              value={Math.floor(Math.max(replayMinTime, Math.min(replayMaxTime, replayTime)))}
              aria-label="ADS-B replay time of day"
              disabled={!replayReady}
              onChange={(event) => onReplayTimeChange(Number(event.currentTarget.value))}
            />
            <span className="replay-time">{replayReady ? formatTimeOfDay(replayTime) : "Loading"}</span>
          </div>

          <div className="replay-speed-group" role="group" aria-label="Replay speed">
            {REPLAY_SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                className="replay-speed-btn"
                aria-pressed={replaySpeed === speed}
                disabled={!replayReady}
                onClick={() => onReplaySpeedChange?.(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="view-opt-btn"
        aria-pressed={showLinks}
        aria-label="Toggle links"
        onClick={onToggleLinks}
      >
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M8.5 11.5a4.5 4.5 0 0 0 6.364 0l1.414-1.414a4.5 4.5 0 0 0-6.364-6.364L8.5 5.136" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M11.5 8.5a4.5 4.5 0 0 0-6.364 0L3.722 9.914a4.5 4.5 0 0 0 6.364 6.364l1.414-1.414" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>

      <button
        type="button"
        className="view-opt-btn"
        aria-pressed={showWaypoints}
        aria-label="Toggle waypoints"
        onClick={onToggleWaypoints}
      >
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M10 2a5 5 0 0 1 5 5c0 3.5-5 11-5 11S5 10.5 5 7a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
          <circle cx="10" cy="7" r="2" stroke="currentColor" strokeWidth="1.6"/>
        </svg>
      </button>

      <button
        type="button"
        className="view-opt-btn"
        aria-pressed={rulerActive}
        aria-label="Toggle ruler"
        onClick={onToggleRuler}
      >
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M3.5 14.5 14.5 3.5l2 2-11 11-2-2Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round"/>
          <path d="m6.25 11.75 1 1M8.5 9.5l1.45 1.45M10.75 7.25l1 1M13 5l1.45 1.45" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </button>
    </section>
  );
}
