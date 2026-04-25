"use client";

type ReplayPlayPauseButtonProps = {
  replayPlaying: boolean;
  disabled: boolean;
  onToggle?: () => void;
};

export default function ReplayPlayPauseButton({
  replayPlaying,
  disabled,
  onToggle,
}: ReplayPlayPauseButtonProps) {
  return (
    <button
      type="button"
      className="view-opt-btn replay-play-btn"
      aria-pressed={replayPlaying}
      aria-label={replayPlaying ? "Pause ADS-B replay" : "Play ADS-B replay"}
      disabled={disabled}
      onClick={onToggle}
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
  );
}
