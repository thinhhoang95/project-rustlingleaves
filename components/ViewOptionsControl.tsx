"use client";

type ViewOptionsControlProps = {
  showLinks: boolean;
  onToggleLinks: () => void;
  showWaypoints: boolean;
  onToggleWaypoints: () => void;
  rulerActive?: boolean;
  onToggleRuler?: () => void;
};

export default function ViewOptionsControl({
  showLinks,
  onToggleLinks,
  showWaypoints,
  onToggleWaypoints,
  rulerActive = false,
  onToggleRuler,
}: ViewOptionsControlProps) {
  return (
    <section className="view-options" aria-label="View options">
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
