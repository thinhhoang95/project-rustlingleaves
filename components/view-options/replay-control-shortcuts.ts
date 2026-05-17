"use client";

import { useEffect } from "react";
import {
  type KeyboardShortcut,
  runShortcutOnce,
  shouldIgnoreShortcutEvent,
} from "@/components/view-options/keyboard-shortcuts";

export const REPLAY_SPEEDS = [5, 10, 20] as const;

type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

export const REPLAY_CONTROL_SHORTCUTS = {
  playPause: {
    label: "Space",
    ariaKeyShortcuts: "Space",
  },
  toggleRunwayTimeline: {
    label: "T",
    ariaKeyShortcuts: "T",
  },
  toggleFlightOperationFilter: {
    label: "F",
    ariaKeyShortcuts: "F",
  },
  toggleAltitudeFilter: {
    label: "A",
    ariaKeyShortcuts: "A",
  },
  seekBackward: {
    label: "Left arrow",
    ariaKeyShortcuts: "ArrowLeft",
  },
  seekForward: {
    label: "Right arrow",
    ariaKeyShortcuts: "ArrowRight",
  },
  jumpStart: {
    label: "Home",
    ariaKeyShortcuts: "Home",
  },
  jumpEnd: {
    label: "End",
    ariaKeyShortcuts: "End",
  },
} satisfies Record<string, KeyboardShortcut>;

export const REPLAY_SPEED_SHORTCUTS = {
  5: {
    label: "1",
    ariaKeyShortcuts: "1",
  },
  10: {
    label: "2",
    ariaKeyShortcuts: "2",
  },
  20: {
    label: "3",
    ariaKeyShortcuts: "3",
  },
} satisfies Record<ReplaySpeed, KeyboardShortcut>;

type ReplayControlShortcutOptions = {
  replayReady: boolean;
  replayTime: number;
  replayMinTime: number;
  replayMaxTime: number;
  onReplayTimeChange?: (time: number) => void;
  onToggleReplayPlaying?: () => void;
  onReplaySpeedChange?: (speed: number) => void;
  onToggleRunwayTimeline?: () => void;
  onToggleFlightOperationFilter?: () => void;
  onToggleAltitudeFilter?: () => void;
};

const SPEED_BY_SHORTCUT_KEY: Record<string, ReplaySpeed> = {
  "1": 5,
  "2": 10,
  "3": 20,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function useReplayControlShortcuts({
  replayReady,
  replayTime,
  replayMinTime,
  replayMaxTime,
  onReplayTimeChange,
  onToggleReplayPlaying,
  onReplaySpeedChange,
  onToggleRunwayTimeline,
  onToggleFlightOperationFilter,
  onToggleAltitudeFilter,
}: ReplayControlShortcutOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreShortcutEvent(event)) {
        return;
      }

      const shortcutKey = event.key.toLowerCase();
      const changeReplayTime = replayReady ? onReplayTimeChange : undefined;

      if ((event.key === " " || event.code === "Space") && replayReady && onToggleReplayPlaying) {
        runShortcutOnce(event, onToggleReplayPlaying);
        return;
      }

      if (shortcutKey === "t" && replayReady && onToggleRunwayTimeline) {
        runShortcutOnce(event, onToggleRunwayTimeline);
        return;
      }

      if (shortcutKey === "f" && onToggleFlightOperationFilter) {
        runShortcutOnce(event, onToggleFlightOperationFilter);
        return;
      }

      if (shortcutKey === "a" && onToggleAltitudeFilter) {
        runShortcutOnce(event, onToggleAltitudeFilter);
        return;
      }

      if (replayReady && onReplaySpeedChange) {
        const speed = SPEED_BY_SHORTCUT_KEY[event.key];
        if (speed) {
          runShortcutOnce(event, () => onReplaySpeedChange(speed));
          return;
        }
      }

      if (!changeReplayTime) {
        return;
      }

      const stepSeconds = event.shiftKey ? 300 : 60;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        changeReplayTime(clamp(replayTime - stepSeconds, replayMinTime, replayMaxTime));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        changeReplayTime(clamp(replayTime + stepSeconds, replayMinTime, replayMaxTime));
      } else if (event.key === "Home") {
        event.preventDefault();
        changeReplayTime(replayMinTime);
      } else if (event.key === "End") {
        event.preventDefault();
        changeReplayTime(replayMaxTime);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onToggleFlightOperationFilter,
    onReplaySpeedChange,
    onReplayTimeChange,
    onToggleAltitudeFilter,
    onToggleReplayPlaying,
    onToggleRunwayTimeline,
    replayMaxTime,
    replayMinTime,
    replayReady,
    replayTime,
  ]);
}
