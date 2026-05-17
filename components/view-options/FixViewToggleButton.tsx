"use client";

import { VIEW_TOGGLE_SHORTCUTS } from "@/components/view-options/view-toggle-shortcuts";

type FixViewToggleButtonProps = {
  showWaypoints: boolean;
  onToggleWaypoints: () => void;
};

export default function FixViewToggleButton({ showWaypoints, onToggleWaypoints }: FixViewToggleButtonProps) {
  const shortcut = VIEW_TOGGLE_SHORTCUTS.fixes;

  return (
    <button
      type="button"
      className="view-opt-btn"
      aria-pressed={showWaypoints}
      aria-label="Toggle fixes"
      aria-keyshortcuts={shortcut.ariaKeyShortcuts}
      title={`Toggle fixes (${shortcut.label})`}
      onClick={onToggleWaypoints}
    >
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M10 2a5 5 0 0 1 5 5c0 3.5-5 11-5 11S5 10.5 5 7a5 5 0 0 1 5-5z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="7" r="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </button>
  );
}
