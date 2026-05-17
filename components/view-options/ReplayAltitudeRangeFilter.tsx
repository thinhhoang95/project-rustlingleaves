"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  DEFAULT_FLIGHT_ALTITUDE_RANGE,
  MAX_FILTER_FLIGHT_LEVEL,
  MIN_FILTER_FLIGHT_LEVEL,
  type FlightAltitudeRange,
  clampFlightLevel,
  FLIGHT_ALTITUDE_STEP_FL,
} from "@/components/adsb-replay/flight-altitude-filter";
import { REPLAY_CONTROL_SHORTCUTS } from "@/components/view-options/replay-control-shortcuts";

type ReplayAltitudeRangeFilterProps = {
  altitudeRange: FlightAltitudeRange;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  onAltitudeRangeChange: (altitudeRange: FlightAltitudeRange) => void;
};

function formatFlightLevel(flightLevel: number): string {
  return `FL${flightLevel.toString().padStart(3, "0")}`;
}

function getRangePercent(flightLevel: number): number {
  const span = MAX_FILTER_FLIGHT_LEVEL - MIN_FILTER_FLIGHT_LEVEL;
  return ((flightLevel - MIN_FILTER_FLIGHT_LEVEL) / span) * 100;
}

export default function ReplayAltitudeRangeFilter({
  altitudeRange,
  menuOpen: controlledMenuOpen,
  onMenuOpenChange,
  onAltitudeRangeChange,
}: ReplayAltitudeRangeFilterProps) {
  const [uncontrolledMenuOpen, setUncontrolledMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lowerId = useId();
  const upperId = useId();
  const menuOpen = controlledMenuOpen ?? uncontrolledMenuOpen;
  const isMenuOpenControlled = typeof controlledMenuOpen === "boolean";
  const lowerFlightLevel = clampFlightLevel(Math.min(altitudeRange.minFlightLevel, altitudeRange.maxFlightLevel));
  const upperFlightLevel = clampFlightLevel(Math.max(altitudeRange.minFlightLevel, altitudeRange.maxFlightLevel));
  const lowerPercent = getRangePercent(lowerFlightLevel);
  const upperPercent = getRangePercent(upperFlightLevel);
  const shortcut = REPLAY_CONTROL_SHORTCUTS.toggleAltitudeFilter;
  const hasAltitudeFilter =
    lowerFlightLevel !== DEFAULT_FLIGHT_ALTITUDE_RANGE.minFlightLevel ||
    upperFlightLevel !== DEFAULT_FLIGHT_ALTITUDE_RANGE.maxFlightLevel;

  const setMenuOpen = (open: boolean) => {
    if (!isMenuOpenControlled) {
      setUncontrolledMenuOpen(open);
    }

    onMenuOpenChange?.(open);
  };

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        if (!isMenuOpenControlled) {
          setUncontrolledMenuOpen(false);
        }

        onMenuOpenChange?.(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!isMenuOpenControlled) {
          setUncontrolledMenuOpen(false);
        }

        onMenuOpenChange?.(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpenControlled, menuOpen, onMenuOpenChange]);

  const setLowerFlightLevel = (nextFlightLevel: number) => {
    onAltitudeRangeChange({
      minFlightLevel: Math.min(clampFlightLevel(nextFlightLevel), upperFlightLevel),
      maxFlightLevel: upperFlightLevel,
    });
  };

  const setUpperFlightLevel = (nextFlightLevel: number) => {
    onAltitudeRangeChange({
      minFlightLevel: lowerFlightLevel,
      maxFlightLevel: Math.max(clampFlightLevel(nextFlightLevel), lowerFlightLevel),
    });
  };

  return (
    <div className="replay-altitude-filter" ref={menuRef}>
      <button
        type="button"
        className="view-opt-btn replay-altitude-filter-button"
        aria-label="Filter replay altitude range"
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        aria-keyshortcuts={shortcut.ariaKeyShortcuts}
        aria-pressed={hasAltitudeFilter}
        title={`Filter replay altitude range (${shortcut.label})`}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M10 3.25v13.5M5.75 7.75 10 3.25l4.25 4.5M5.75 12.25 10 16.75l4.25-4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {menuOpen ? (
        <div className="replay-altitude-filter-menu" role="dialog" aria-label="Replay altitude range">
          <div className="replay-altitude-filter-values">
            <span>{formatFlightLevel(lowerFlightLevel)}</span>
            <span>{formatFlightLevel(upperFlightLevel)}</span>
          </div>
          <div
            className="replay-altitude-range-slider"
            style={{
              "--altitude-range-left": `${lowerPercent}%`,
              "--altitude-range-width": `${Math.max(0, upperPercent - lowerPercent)}%`,
            } as CSSProperties}
          >
            <div className="replay-altitude-range-track" aria-hidden="true" />
            <label className="sr-only" htmlFor={lowerId}>
              Minimum replay flight level
            </label>
            <input
              id={lowerId}
              type="range"
              min={MIN_FILTER_FLIGHT_LEVEL}
              max={MAX_FILTER_FLIGHT_LEVEL}
              step={FLIGHT_ALTITUDE_STEP_FL}
              value={lowerFlightLevel}
              aria-valuetext={formatFlightLevel(lowerFlightLevel)}
              onChange={(event) => setLowerFlightLevel(Number(event.currentTarget.value))}
            />
            <label className="sr-only" htmlFor={upperId}>
              Maximum replay flight level
            </label>
            <input
              id={upperId}
              type="range"
              min={MIN_FILTER_FLIGHT_LEVEL}
              max={MAX_FILTER_FLIGHT_LEVEL}
              step={FLIGHT_ALTITUDE_STEP_FL}
              value={upperFlightLevel}
              aria-valuetext={formatFlightLevel(upperFlightLevel)}
              onChange={(event) => setUpperFlightLevel(Number(event.currentTarget.value))}
            />
          </div>
          <div className="replay-altitude-filter-scale" aria-hidden="true">
            <span>FL000</span>
            <span>FL200</span>
            <span>FL400</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
