'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import MeasurePanel, { buildMeasureSegments } from "@/components/MeasurePanel";
import MapView from "@/components/map-view";
import type { MapCoordinate, MapSearchItem } from "@/components/map-view-types";
import ViewOptionsControl from "@/components/ViewOptionsControl";
import { useAdsbReplay } from "@/components/adsb-replay/useAdsbReplay";
import type { ReplayMode } from "@/components/adsb-replay/types";

export default function Page() {
  const [replayMode, setReplayMode] = useState<ReplayMode>("adsb");
  const [replayTime, setReplayTime] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [showLinks, setShowLinks] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [rulerActive, setRulerActive] = useState(false);
  const [rulerPoints, setRulerPoints] = useState<MapCoordinate[]>([]);
  const [searchItems, setSearchItems] = useState<MapSearchItem[]>([]);
  const [selectedSearchTarget, setSelectedSearchTarget] = useState<{ id: string; requestId: number } | null>(null);
  const adsbReplay = useAdsbReplay(replayTime);

  const measureSegments = useMemo(() => buildMeasureSegments(rulerPoints), [rulerPoints]);
  const effectiveReplayTime = replayTime || adsbReplay.metadata?.minTime || 0;

  useEffect(() => {
    window.__ADS_B_REPLAY_TIME_OF_DAY__ = ((Math.floor(effectiveReplayTime) % 86400) + 86400) % 86400;
  }, [effectiveReplayTime]);

  useEffect(() => {
    const replayMetadata = adsbReplay.metadata;
    if (!replayPlaying || replayMode !== "adsb" || !replayMetadata) {
      return;
    }

    let animationFrame = 0;
    let previousTimestamp: number | null = null;

    const tick = (timestamp: number) => {
      if (previousTimestamp === null) {
        previousTimestamp = timestamp;
      }

      const elapsedSeconds = ((timestamp - previousTimestamp) / 1000) * replaySpeed;
      previousTimestamp = timestamp;

      setReplayTime((currentTime) => {
        const baseTime = currentTime || replayMetadata.minTime;
        const nextTime = baseTime + elapsedSeconds;
        if (nextTime > replayMetadata.maxTime) {
          return replayMetadata.minTime;
        }
        return nextTime;
      });

      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [adsbReplay.metadata, replayMode, replayPlaying, replaySpeed]);

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
        replayMode={replayMode}
        onReplayModeChange={(mode) => {
          setReplayMode(mode);
          setReplayPlaying(false);
        }}
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
        replayMode={replayMode}
        replayFlights={adsbReplay.flights}
        replaySnapshot={adsbReplay.snapshot}
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
          replayMode={replayMode}
          replayTime={effectiveReplayTime}
          replayMinTime={adsbReplay.metadata?.minTime}
          replayMaxTime={adsbReplay.metadata?.maxTime}
          replayPlaying={replayPlaying}
          replaySpeed={replaySpeed}
          replayLoading={adsbReplay.loading}
          onReplayTimeChange={(time) => {
            setReplayPlaying(false);
            setReplayTime(time);
          }}
          onToggleReplayPlaying={() => setReplayPlaying((previous) => !previous)}
          onReplaySpeedChange={setReplaySpeed}
        />
      </div>
    </main>
  );
}
