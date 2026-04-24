'use client';

import { useState } from "react";
import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import MapView, { type MapSearchItem } from "@/components/map-view";
import ViewOptionsControl from "@/components/ViewOptionsControl";

export default function Page() {
  const [showLinks, setShowLinks] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [searchItems, setSearchItems] = useState<MapSearchItem[]>([]);
  const [selectedSearchTarget, setSelectedSearchTarget] = useState<{ id: string; requestId: number } | null>(null);

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
        selectedSearchTarget={selectedSearchTarget}
        onSearchItemsChange={setSearchItems}
      />

      <div className="view-options-anchor">
        <ViewOptionsControl
          showLinks={showLinks}
          onToggleLinks={() => setShowLinks((prev) => !prev)}
          showWaypoints={showWaypoints}
          onToggleWaypoints={() => setShowWaypoints((prev) => !prev)}
        />
      </div>
    </main>
  );
}
