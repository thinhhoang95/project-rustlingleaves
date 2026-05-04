"use client";

import { useEffect, useRef, useState } from "react";
import type { ReplayMode } from "@/components/adsb-replay/types";
import ShimmeringText from "@/components/ShimmeringText";

type ReplayModeSwitchProps = {
  replayMode: ReplayMode;
  simulationCacheLoading: boolean;
  onReplayModeChange: (mode: ReplayMode) => void;
  onInvalidateSimulationCache: () => void;
};

export default function ReplayModeSwitch({
  replayMode,
  simulationCacheLoading,
  onReplayModeChange,
  onInvalidateSimulationCache,
}: ReplayModeSwitchProps) {
  const [simulationMenuOpen, setSimulationMenuOpen] = useState(false);
  const simulationMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!simulationMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!simulationMenuRef.current?.contains(event.target as Node)) {
        setSimulationMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [simulationMenuOpen]);

  return (
    <div className="mode-switch" role="group" aria-label="Replay mode">
      <div
        className="mode-switch-split"
        data-active={replayMode === "simulation" ? "true" : "false"}
        ref={simulationMenuRef}
      >
        <button
          type="button"
          className="mode-switch-button mode-switch-button-main"
          aria-pressed={replayMode === "simulation"}
          onClick={() => onReplayModeChange("simulation")}
        >
          {simulationCacheLoading && replayMode === "simulation" ? (
            <ShimmeringText text="Simulation" className="mode-loading-text" />
          ) : (
            "Simulation"
          )}
        </button>
        <button
          type="button"
          className="mode-switch-chevron"
          aria-label="Simulation options"
          aria-expanded={simulationMenuOpen}
          aria-haspopup="menu"
          onClick={() => setSimulationMenuOpen((open) => !open)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5.5 7.25 10 11.75l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {simulationMenuOpen ? (
          <div className="mode-switch-menu" role="menu">
            <button
              type="button"
              className="mode-switch-menu-item"
              role="menuitem"
              onClick={() => {
                setSimulationMenuOpen(false);
                onInvalidateSimulationCache();
              }}
            >
              Invalidate Cache
            </button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="mode-switch-button"
        aria-pressed={replayMode === "adsb"}
        onClick={() => onReplayModeChange("adsb")}
      >
        ADS-B
      </button>
    </div>
  );
}
