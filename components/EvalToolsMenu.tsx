"use client";

import { useEffect, useRef, useState } from "react";

type EvalToolsMenuProps = {
  onOpenFeasibility: () => void;
  onOpenConflicts: () => void;
  onOpenRunwayUse: () => void;
};

export default function EvalToolsMenu({ onOpenFeasibility, onOpenConflicts, onOpenRunwayUse }: EvalToolsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  return (
    <div className="eval-tools-menu" ref={menuRef}>
      <button
        type="button"
        className="eval-tools-button"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        Eval Tools
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5.5 7.25 10 11.75l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menuOpen ? (
        <div className="eval-tools-context-menu" role="menu">
          <button
            type="button"
            className="mode-switch-menu-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onOpenFeasibility();
            }}
          >
            Feasibility
          </button>
          <button
            type="button"
            className="mode-switch-menu-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onOpenConflicts();
            }}
          >
            Conflicts
          </button>
          <button
            type="button"
            className="mode-switch-menu-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onOpenRunwayUse();
            }}
          >
            Runway Use
          </button>
        </div>
      ) : null}
    </div>
  );
}
