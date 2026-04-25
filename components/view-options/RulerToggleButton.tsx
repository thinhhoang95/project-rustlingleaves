"use client";

type RulerToggleButtonProps = {
  rulerActive: boolean;
  onToggleRuler?: () => void;
};

export default function RulerToggleButton({ rulerActive, onToggleRuler }: RulerToggleButtonProps) {
  return (
    <button
      type="button"
      className="view-opt-btn"
      aria-pressed={rulerActive}
      aria-label="Toggle ruler"
      onClick={onToggleRuler}
    >
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M3.5 14.5 14.5 3.5l2 2-11 11-2-2Z"
          stroke="currentColor"
          strokeWidth="1.55"
          strokeLinejoin="round"
        />
        <path
          d="m6.25 11.75 1 1M8.5 9.5l1.45 1.45M10.75 7.25l1 1M13 5l1.45 1.45"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
