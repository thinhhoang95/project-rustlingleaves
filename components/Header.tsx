'use client';

import { useMemo, useRef, useState } from "react";
import type { ReplayMode } from "@/components/adsb-replay/types";
import ReplayModeSwitch from "@/components/view-options/ReplayModeSwitch";

export type HeaderSearchItem = {
  id: string;
  name: string;
  type: "Waypoint" | "VOR" | "Runway" | "Flight";
  callsign?: string;
};

type HeaderProps = {
  isChatOpen: boolean;
  onToggleChat: () => void;
  searchItems: HeaderSearchItem[];
  onSelectSearchItem: (itemId: string) => void;
  replayMode: ReplayMode;
  onReplayModeChange: (mode: ReplayMode) => void;
  simulationCacheLoading: boolean;
  onInvalidateSimulationCache: () => void;
};

export default function Header({
  isChatOpen,
  onToggleChat,
  searchItems,
  onSelectSearchItem,
  replayMode,
  onReplayModeChange,
  simulationCacheLoading,
  onInvalidateSimulationCache,
}: HeaderProps) {
  const [query, setQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const blurTimeoutRef = useRef<number | null>(null);
  const normalizedQuery = query.trim().toUpperCase();
  const results = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return searchItems
      .filter((item) => {
        const normalizedName = item.name.toUpperCase();
        const normalizedCallsign = item.callsign?.toUpperCase() ?? "";
        return normalizedName.includes(normalizedQuery) || normalizedCallsign.includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftName = left.name.toUpperCase();
        const rightName = right.name.toUpperCase();
        const leftCallsign = left.callsign?.toUpperCase() ?? "";
        const rightCallsign = right.callsign?.toUpperCase() ?? "";
        const leftExact = leftName === normalizedQuery || leftCallsign === normalizedQuery ? 0 : 1;
        const rightExact = rightName === normalizedQuery || rightCallsign === normalizedQuery ? 0 : 1;
        const leftStarts = leftName.startsWith(normalizedQuery) || leftCallsign.startsWith(normalizedQuery) ? 0 : 1;
        const rightStarts = rightName.startsWith(normalizedQuery) || rightCallsign.startsWith(normalizedQuery) ? 0 : 1;
        return leftExact - rightExact || leftStarts - rightStarts || leftName.localeCompare(rightName);
      })
      .slice(0, 8);
  }, [normalizedQuery, searchItems]);
  const showResults = isSearchFocused && normalizedQuery.length > 0;

  function handleSearchFocus() {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsSearchFocused(true);
  }

  function handleSearchBlur() {
    blurTimeoutRef.current = window.setTimeout(() => setIsSearchFocused(false), 120);
  }

  function handleSelectSearchItem(itemId: string) {
    onSelectSearchItem(itemId);
    setQuery("");
    setIsSearchFocused(false);
  }

  return (
    <header className="app-header">
      <div className="app-title">
        <h1>Approach Claw</h1>
      </div>

      <nav aria-label="Primary navigation" className="app-nav">
        <ReplayModeSwitch
          replayMode={replayMode}
          simulationCacheLoading={simulationCacheLoading}
          onReplayModeChange={onReplayModeChange}
          onInvalidateSimulationCache={onInvalidateSimulationCache}
        />

        <div className="fix-search" role="search">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="fix-search-icon">
            <path d="M10.5 4a6.5 6.5 0 014.98 10.68l4.42 4.42-1.4 1.4-4.42-4.42A6.5 6.5 0 1110.5 4zm0 2a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
          </svg>
          <input
            type="search"
            value={query}
            aria-label="Search waypoint, VOR, runway, or flight callsign"
            placeholder="Search fixes or callsigns"
            className="fix-search-input"
            onBlur={handleSearchBlur}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={handleSearchFocus}
          />
          {showResults ? (
            <div className="fix-search-results" role="listbox" aria-label="Search results">
              {results.length > 0 ? (
                results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="fix-search-result"
                    role="option"
                    aria-selected="false"
                    onClick={() => handleSelectSearchItem(item.id)}
                  >
                    <span className="fix-search-result-name">{item.name}</span>
                    <span className="fix-search-result-type">{item.type}</span>
                  </button>
                ))
              ) : (
                <div className="fix-search-empty">No matching fixes or flights</div>
              )}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          aria-pressed={isChatOpen}
          aria-label="Toggle chat panel"
          className="app-nav-button"
          onClick={onToggleChat}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="app-nav-icon"
          >
            <path d="M7 20l-4 2V7a3 3 0 013-3h12a3 3 0 013 3v7a3 3 0 01-3 3H9.5L7 20zm0-2.18L8.84 16H18a1 1 0 001-1V7a1 1 0 00-1-1H6a1 1 0 00-1 1v10.25l1.2-.82.8.39z" />
          </svg>
        </button>
      </nav>
    </header>
  );
}
