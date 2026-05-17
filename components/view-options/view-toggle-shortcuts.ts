"use client";

import { useEffect } from "react";
import {
  type KeyboardShortcut,
  runShortcutOnce,
  shouldIgnoreShortcutEvent,
} from "@/components/view-options/keyboard-shortcuts";

export const VIEW_TOGGLE_SHORTCUTS = {
  proceduralLinks: {
    label: "L",
    ariaKeyShortcuts: "L",
  },
  fixes: {
    label: "W",
    ariaKeyShortcuts: "W",
  },
} satisfies Record<string, KeyboardShortcut>;

type ViewToggleShortcutOptions = {
  onToggleLinks: () => void;
  onToggleWaypoints: () => void;
};

export function useViewToggleShortcuts({
  onToggleLinks,
  onToggleWaypoints,
}: ViewToggleShortcutOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreShortcutEvent(event)) {
        return;
      }

      const shortcutKey = event.key.toLowerCase();
      if (shortcutKey === "l") {
        runShortcutOnce(event, onToggleLinks);
      } else if (shortcutKey === "w") {
        runShortcutOnce(event, onToggleWaypoints);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleLinks, onToggleWaypoints]);
}
