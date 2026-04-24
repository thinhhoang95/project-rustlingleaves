"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";

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
}: TimeScrubberPopoverProps) {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || !open || !anchor || !position) {
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
        <div className="view-options">
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
