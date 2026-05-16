"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import type { FlightOperationGroup, FlightOperationVisibility } from "@/components/adsb-replay/flight-line-colors";

type TimeScrubberPopoverProps = {
  anchor: HTMLElement | null;
  open: boolean;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  glanceHorizonMinutes?: number;
  onGlanceHorizonChange?: (minutes: number) => void;
  flightOperationVisibility?: FlightOperationVisibility;
  onFlightOperationVisibilityChange?: (visibility: FlightOperationVisibility) => void;
};

type Position = {
  top: number;
  left: number;
};

function formatSecondsToHHMMSS(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

type FlightOperationFilterMenuButtonProps = {
  visibility: FlightOperationVisibility;
  onVisibilityChange: (visibility: FlightOperationVisibility) => void;
};

const FLIGHT_OPERATION_FILTER_OPTIONS: Array<{
  key: FlightOperationGroup;
  label: string;
  color: string;
}> = [
  { key: "departure", label: "Departures", color: "#86efac" },
  { key: "arrival", label: "Arrivals", color: "#38bdf8" },
  { key: "unknown", label: "Others", color: "#fde047" },
];

export function FlightOperationFilterMenuButton({
  visibility,
  onVisibilityChange,
}: FlightOperationFilterMenuButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasHiddenOperationGroup = Object.values(visibility).some((visible) => !visible);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const setOperationGroupVisible = (operationGroup: FlightOperationGroup, visible: boolean) => {
    onVisibilityChange({
      ...visibility,
      [operationGroup]: visible,
    });
  };

  return (
    <div className="flight-operation-filter" ref={menuRef}>
      <button
        type="button"
        className="view-opt-btn flight-operation-filter-button"
        aria-label="Filter replay flight lines"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-pressed={hasHiddenOperationGroup}
        title="Filter replay flight lines"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M3.5 4.5h13L11.8 10v4.4l-3.6 1.5V10L3.5 4.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {menuOpen ? (
        <div className="flight-operation-filter-menu" role="menu" aria-label="Replay flight line filters">
          {FLIGHT_OPERATION_FILTER_OPTIONS.map((option) => (
            <label
              className="flight-operation-filter-item"
              role="menuitemcheckbox"
              aria-checked={visibility[option.key]}
              key={option.key}
            >
              <input
                type="checkbox"
                checked={visibility[option.key]}
                onChange={(event) => setOperationGroupVisible(option.key, event.currentTarget.checked)}
              />
              <span className="flight-operation-filter-swatch" style={{ backgroundColor: option.color }} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function TimeScrubberPopover({
  anchor,
  open,
  value,
  min = 0,
  max = 24 * 3600 - 1,
  onChange,
  onCommit,
  glanceHorizonMinutes,
  onGlanceHorizonChange,
  flightOperationVisibility,
  onFlightOperationVisibilityChange,
}: TimeScrubberPopoverProps) {
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (!open || !anchor) {
      return;
    }

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: rect.top + window.scrollY - 12,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor, open]);

  if (typeof document === "undefined" || !open || !anchor || !position) {
    return null;
  }

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.currentTarget.value);
    onChange(nextValue);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute -translate-x-1/2 -translate-y-full pointer-events-auto"
        style={{ top: position.top, left: position.left }}
      >
        <div className="view-options time-scrubber-popover">
          <div className="view-option-group">
            <span className="view-option-label">Time</span>
            <input
              type="range"
              min={Math.floor(min)}
              max={Math.floor(max)}
              step={60}
              value={Math.floor(value)}
              onChange={handleSliderChange}
              onMouseUp={() => onCommit(Math.floor(value))}
              onTouchEnd={() => onCommit(Math.floor(value))}
            />
          </div>
          <span className="view-option-button view-option-button-stub">{formatSecondsToHHMMSS(value)}</span>
          {typeof glanceHorizonMinutes === "number" && onGlanceHorizonChange && (
            <button
              type="button"
              className="view-option-button view-option-button-stub"
              onClick={() => onGlanceHorizonChange(glanceHorizonMinutes)}
            >
              Horizon {glanceHorizonMinutes}m
            </button>
          )}
          {flightOperationVisibility && onFlightOperationVisibilityChange ? (
            <FlightOperationFilterMenuButton
              visibility={flightOperationVisibility}
              onVisibilityChange={onFlightOperationVisibilityChange}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
