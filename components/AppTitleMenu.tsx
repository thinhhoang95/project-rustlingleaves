"use client";

import { useEffect, useRef, useState } from "react";
import { APP_INFO } from "@/app/app-info";

type AppTitleMenuProps = {
  onOpenAbout: () => void;
};

export default function AppTitleMenu({ onOpenAbout }: AppTitleMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="app-title" ref={menuRef}>
      <button
        type="button"
        className="app-title-button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <span>{APP_INFO.name}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5.5 7.25 10 11.75l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="app-title-context-menu" role="menu">
          <button
            type="button"
            className="mode-switch-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenAbout();
            }}
          >
            About
          </button>
        </div>
      ) : null}
    </div>
  );
}
