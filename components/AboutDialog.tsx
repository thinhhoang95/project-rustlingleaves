"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { APP_INFO } from "@/app/app-info";

type AboutDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function AboutDialog({ open, onClose }: AboutDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="about-modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <section
        className="about-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
      >
        <button
          type="button"
          className="about-modal-close"
          aria-label="Close About dialog"
          onClick={onClose}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="about-modal-header">
          <p className="about-modal-kicker">About</p>
          <h2 id="about-modal-title">{APP_INFO.name}</h2>
          <p className="about-modal-note">
            Without the support of my wife, I would not be able to realize this work. Thank you for your endless love and support. This work is dedicated to you, Vy Tran.
          </p>
        </div>
        <dl className="about-modal-details">
          <div>
            <dt>Version</dt>
            <dd>{APP_INFO.version}</dd>
          </div>
          <div>
            <dt>Release date</dt>
            <dd>{APP_INFO.releaseDate}</dd>
          </div>
          <div>
            <dt>Author</dt>
            <dd>{APP_INFO.author.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${APP_INFO.author.email}`}>{APP_INFO.author.email}</a>
            </dd>
          </div>
        </dl>
      </section>
    </div>,
    document.body,
  );
}
