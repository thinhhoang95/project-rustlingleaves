"use client";

type LinkViewToggleButtonProps = {
  showLinks: boolean;
  onToggleLinks: () => void;
};

export default function LinkViewToggleButton({ showLinks, onToggleLinks }: LinkViewToggleButtonProps) {
  return (
    <button
      type="button"
      className="view-opt-btn"
      aria-pressed={showLinks}
      aria-label="Toggle links"
      onClick={onToggleLinks}
    >
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M8.5 11.5a4.5 4.5 0 0 0 6.364 0l1.414-1.414a4.5 4.5 0 0 0-6.364-6.364L8.5 5.136"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M11.5 8.5a4.5 4.5 0 0 0-6.364 0L3.722 9.914a4.5 4.5 0 0 0 6.364 6.364l1.414-1.414"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
