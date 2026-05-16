"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type FlightLineLabelMode = "flightLevel" | "callsign";

type FlightLineLabelPopoverProps = {
  anchor: HTMLElement | null;
  open: boolean;
  mode: FlightLineLabelMode;
  onSelect: (mode: FlightLineLabelMode) => void;
  onClose: () => void;
};

type Position = {
  top: number;
  left: number;
};

export default function FlightLineLabelPopover({
  anchor,
  open,
  mode,
  onSelect,
  onClose,
}: FlightLineLabelPopoverProps) {
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

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  if (!open || !position) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        style={{ top: position.top, left: position.left }}
        className="absolute -translate-x-1/2 -translate-y-full pointer-events-auto"
      >
        <div className="view-options" role="dialog" aria-label="Flight line label mode">
          <button
            type="button"
            className="view-option-button"
            aria-pressed={mode === "flightLevel"}
            onClick={() => onSelect("flightLevel")}
          >
            Flight level
          </button>
          <button
            type="button"
            className="view-option-button"
            aria-pressed={mode === "callsign"}
            onClick={() => onSelect("callsign")}
          >
            Callsign
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
