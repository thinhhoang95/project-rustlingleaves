'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import MeasurePanel, { buildMeasureSegments } from "@/components/MeasurePanel";
import MapView, { type MapCoordinate, type MapSearchItem } from "@/components/map-view";
import ViewOptionsControl from "@/components/ViewOptionsControl";

export default function Page() {
  const [showLinks, setShowLinks] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [rulerActive, setRulerActive] = useState(false);
  const [rulerPoints, setRulerPoints] = useState<MapCoordinate[]>([]);
  const [searchItems, setSearchItems] = useState<MapSearchItem[]>([]);
  const [selectedSearchTarget, setSelectedSearchTarget] = useState<{ id: string; requestId: number } | null>(null);

  const measureSegments = useMemo(() => buildMeasureSegments(rulerPoints), [rulerPoints]);

  const closeRuler = useCallback(() => {
    setRulerActive(false);
    setRulerPoints([]);
  }, []);

  useEffect(() => {
    if (!rulerActive) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRuler();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeRuler, rulerActive]);

  return (
    <main className="arrivals-page">
      <Header
        isChatOpen={showChat}
        onToggleChat={() => setShowChat((prev) => !prev)}
        searchItems={searchItems}
        onSelectSearchItem={(itemId) =>
          setSelectedSearchTarget((previousTarget) => ({
            id: itemId,
            requestId: (previousTarget?.requestId ?? 0) + 1,
          }))
        }
      />
      {showChat ? (
        <div className="chat-panel-anchor">
          <ChatPanel />
        </div>
      ) : null}
      <MapView
        showWaypoints={showWaypoints}
        showLinks={showLinks}
        rulerActive={rulerActive}
        rulerPoints={rulerPoints}
        onAddRulerPoint={(point) => setRulerPoints((previousPoints) => [...previousPoints, point])}
        selectedSearchTarget={selectedSearchTarget}
        onSearchItemsChange={setSearchItems}
      />

      <div className="view-options-anchor">
        {rulerActive ? <MeasurePanel points={rulerPoints} segments={measureSegments} /> : null}
        <ViewOptionsControl
          showLinks={showLinks}
          onToggleLinks={() => setShowLinks((prev) => !prev)}
          showWaypoints={showWaypoints}
          onToggleWaypoints={() => setShowWaypoints((prev) => !prev)}
          rulerActive={rulerActive}
          onToggleRuler={() => {
            if (rulerActive) {
              closeRuler();
            } else {
              setRulerActive(true);
              setRulerPoints([]);
            }
          }}
        />
      </div>
    </main>
  );
}
