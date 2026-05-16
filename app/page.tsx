'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import AdsbFlightDetailsPanel from "@/components/AdsbFlightDetailsPanel";
import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import MeasurePanel, { buildMeasureSegments } from "@/components/MeasurePanel";
import MapView from "@/components/map-view";
import SimulationConflictsPanel, { type SimulationConflictSelection } from "@/components/SimulationConflictsPanel";
import SimulationFeasibilityPanel from "@/components/SimulationFeasibilityPanel";
import SimulationFlightDetailsPanel from "@/components/SimulationFlightDetailsPanel";
import type { MapCoordinate, MapSearchItem, MapSelectionTarget } from "@/components/map-view-types";
import ViewOptionsControl from "@/components/ViewOptionsControl";
import { DEFAULT_FLIGHT_ALTITUDE_RANGE } from "@/components/adsb-replay/flight-altitude-filter";
import { DEFAULT_FLIGHT_OPERATION_VISIBILITY } from "@/components/adsb-replay/flight-line-colors";
import { useAdsbReplay } from "@/components/adsb-replay/useAdsbReplay";
import { useSimulationReplay } from "@/components/adsb-replay/useSimulationReplay";
import type { ReplayMode } from "@/components/adsb-replay/types";
import type {
  SimulationConflict,
  SimulationConflictPreviewConfig,
} from "@/components/simulation-conflict-preview";

export default function Page() {
  const [replayMode, setReplayMode] = useState<ReplayMode>("adsb");
  const [adsbReplayTime, setAdsbReplayTime] = useState(0);
  const [simulationReplayTime, setSimulationReplayTime] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [showLinks, setShowLinks] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [rulerActive, setRulerActive] = useState(false);
  const [rulerPoints, setRulerPoints] = useState<MapCoordinate[]>([]);
  const [searchItems, setSearchItems] = useState<MapSearchItem[]>([]);
  const [selectedSearchTarget, setSelectedSearchTarget] = useState<MapSelectionTarget | null>(null);
  const [selectedAdsbFlightId, setSelectedAdsbFlightId] = useState<string | null>(null);
  const [selectedSimulationFlightId, setSelectedSimulationFlightId] = useState<string | null>(null);
  const [showFeasibilityPanel, setShowFeasibilityPanel] = useState(false);
  const [showConflictsPanel, setShowConflictsPanel] = useState(false);
  const [conflictViewEnabled, setConflictViewEnabled] = useState(false);
  const [simulationConflicts, setSimulationConflicts] = useState<SimulationConflict[]>([]);
  const [simulationEvalRefreshToken, setSimulationEvalRefreshToken] = useState(0);
  const [flightAltitudeRange, setFlightAltitudeRange] = useState(DEFAULT_FLIGHT_ALTITUDE_RANGE);
  const [flightOperationVisibility, setFlightOperationVisibility] = useState(DEFAULT_FLIGHT_OPERATION_VISIBILITY);
  const adsbReplay = useAdsbReplay(adsbReplayTime);
  const simulationReplay = useSimulationReplay(simulationReplayTime);
  const activeReplay = replayMode === "simulation" ? simulationReplay : adsbReplay;
  const setActiveReplayTime = replayMode === "simulation" ? setSimulationReplayTime : setAdsbReplayTime;

  const measureSegments = useMemo(() => buildMeasureSegments(rulerPoints), [rulerPoints]);
  const simulationConflictPreview = useMemo<SimulationConflictPreviewConfig>(
    () => ({
      enabled: replayMode === "simulation" && showConflictsPanel && conflictViewEnabled,
      conflicts: simulationConflicts,
    }),
    [conflictViewEnabled, replayMode, showConflictsPanel, simulationConflicts],
  );
  const effectiveReplayTime =
    (replayMode === "simulation" ? simulationReplayTime : adsbReplayTime) ||
    activeReplay.metadata?.minTime ||
    0;
  const headerSearchItems = useMemo<MapSearchItem[]>(() => {
    const flightItems = activeReplay.flights.map((flight) => ({
      id: `flight:${flight.id}`,
      name: flight.callsign || flight.id,
      callsign: flight.callsign,
      type: "Flight" as const,
      flightId: flight.id,
      firstTime: flight.firstTime,
      lastTime: flight.lastTime,
    }));

    return [...searchItems, ...flightItems];
  }, [activeReplay.flights, searchItems]);
  const selectedSimulationFlight = useMemo(
    () =>
      replayMode === "simulation" && selectedSimulationFlightId
        ? simulationReplay.flights.find((flight) => flight.id === selectedSimulationFlightId) ?? null
        : null,
    [replayMode, selectedSimulationFlightId, simulationReplay.flights],
  );
  const selectedAdsbFlight = useMemo(
    () =>
      replayMode === "adsb" && selectedAdsbFlightId
        ? adsbReplay.flights.find((flight) => flight.id === selectedAdsbFlightId) ?? null
        : null,
    [adsbReplay.flights, replayMode, selectedAdsbFlightId],
  );
  const selectMapTarget = useCallback((itemId: string, time?: number, coordinates?: MapCoordinate, zoom?: number) => {
    setSelectedSearchTarget((previousTarget) => ({
      id: itemId,
      requestId: (previousTarget?.requestId ?? 0) + 1,
      time,
      coordinates,
      zoom,
    }));
  }, []);
  const selectSimulationFlight = useCallback((flightId: string) => {
    setSelectedSimulationFlightId(flightId);
  }, []);
  const deselectSimulationFlight = useCallback(() => {
    setSelectedSimulationFlightId(null);
  }, []);
  const selectAdsbFlight = useCallback((flightId: string) => {
    setSelectedAdsbFlightId(flightId);
  }, []);
  const deselectAdsbFlight = useCallback(() => {
    setSelectedAdsbFlightId(null);
  }, []);
  const openFeasibilityPanel = useCallback(() => {
    setReplayMode("simulation");
    setReplayPlaying(false);
    deselectAdsbFlight();
    setShowFeasibilityPanel(true);
  }, [deselectAdsbFlight]);
  const closeFeasibilityPanel = useCallback(() => {
    setShowFeasibilityPanel(false);
  }, []);
  const openConflictsPanel = useCallback(() => {
    setReplayMode("simulation");
    setReplayPlaying(false);
    deselectAdsbFlight();
    setShowConflictsPanel(true);
  }, [deselectAdsbFlight]);
  const closeConflictsPanel = useCallback(() => {
    setShowConflictsPanel(false);
    setConflictViewEnabled(false);
  }, []);
  const selectFixFromFlightDetails = useCallback(
    (fixName: string) => {
      const normalizedFixName = fixName.trim().toUpperCase();
      const item = searchItems.find(
        (searchItem) =>
          searchItem.type !== "Flight" &&
          searchItem.name.trim().toUpperCase() === normalizedFixName,
      );

      if (!item) {
        return;
      }

      if (item.type === "Waypoint") {
        setShowWaypoints(true);
      }
      selectMapTarget(item.id);
    },
    [searchItems, selectMapTarget],
  );
  const selectSimulationFlightFromEval = useCallback(
    (flightId: string) => {
      const flight = simulationReplay.flights.find((candidate) => candidate.id === flightId);
      const targetTime =
        flight && (simulationReplayTime < flight.firstTime || simulationReplayTime > flight.lastTime)
          ? flight.firstTime
          : flight
            ? simulationReplayTime || flight.firstTime
            : undefined;

      setReplayMode("simulation");
      setReplayPlaying(false);
      deselectAdsbFlight();
      selectSimulationFlight(flightId);

      if (targetTime !== undefined && targetTime !== simulationReplayTime) {
        setSimulationReplayTime(targetTime);
      }

      selectMapTarget(`flight:${flightId}`, targetTime);
    },
    [deselectAdsbFlight, selectMapTarget, selectSimulationFlight, simulationReplay.flights, simulationReplayTime],
  );
  const selectSimulationConflict = useCallback(
    (selection: SimulationConflictSelection) => {
      setReplayMode("simulation");
      setReplayPlaying(false);
      deselectAdsbFlight();
      setSimulationReplayTime(selection.time);
      selectMapTarget(`conflict:${selection.conflictId}`, selection.time, selection.coordinate, 10);
    },
    [deselectAdsbFlight, selectMapTarget],
  );

  useEffect(() => {
    window.__ADS_B_REPLAY_TIME_OF_DAY__ = ((Math.floor(effectiveReplayTime) % 86400) + 86400) % 86400;
  }, [effectiveReplayTime]);

  useEffect(() => {
    const replayMetadata = activeReplay.metadata;
    if (!replayPlaying || !replayMetadata) {
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

      setActiveReplayTime((currentTime) => {
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
  }, [activeReplay.metadata, replayPlaying, replaySpeed, setActiveReplayTime]);

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
        searchItems={headerSearchItems}
        replayMode={replayMode}
        onReplayModeChange={(mode) => {
          setReplayMode(mode);
          setReplayPlaying(false);
          if (mode === "simulation") {
            deselectAdsbFlight();
          } else {
            deselectSimulationFlight();
            closeFeasibilityPanel();
            closeConflictsPanel();
          }
        }}
        onOpenFeasibilityPanel={openFeasibilityPanel}
        onOpenConflictsPanel={openConflictsPanel}
        simulationCacheLoading={simulationReplay.loading || simulationReplay.invalidating}
        onInvalidateSimulationCache={() => {
          setReplayMode("simulation");
          setReplayPlaying(false);
          setSimulationReplayTime(0);
          setSimulationEvalRefreshToken((token) => token + 1);
          deselectAdsbFlight();
          deselectSimulationFlight();
          closeFeasibilityPanel();
          closeConflictsPanel();
          void simulationReplay.invalidateCache();
        }}
        onSelectSearchItem={(itemId) => {
          const item = headerSearchItems.find((searchItem) => searchItem.id === itemId);
          const targetTime =
            item?.type === "Flight" && (effectiveReplayTime < item.firstTime || effectiveReplayTime > item.lastTime)
              ? item.firstTime
              : item?.type === "Flight"
                ? effectiveReplayTime
                : undefined;

          if (item?.type === "Flight") {
            setReplayPlaying(false);
            if (replayMode === "simulation") {
              deselectAdsbFlight();
              selectSimulationFlight(item.flightId);
            } else {
              selectAdsbFlight(item.flightId);
              deselectSimulationFlight();
            }
            if (targetTime !== undefined && targetTime !== effectiveReplayTime) {
              setActiveReplayTime(targetTime);
            }
          } else {
            deselectAdsbFlight();
            deselectSimulationFlight();
          }

          selectMapTarget(itemId, targetTime);
        }}
      />
      <MapView
        showWaypoints={showWaypoints}
        showLinks={showLinks}
        rulerActive={rulerActive}
        rulerPoints={rulerPoints}
        onAddRulerPoint={(point) => setRulerPoints((previousPoints) => [...previousPoints, point])}
        selectedSearchTarget={selectedSearchTarget}
        onSelectReplayFlight={(flightId) => {
          if (replayMode === "simulation") {
            deselectAdsbFlight();
            selectSimulationFlight(flightId);
          } else {
            selectAdsbFlight(flightId);
            deselectSimulationFlight();
          }
        }}
        onSearchItemsChange={setSearchItems}
        replayMode={replayMode}
        replayFlights={activeReplay.flights}
        replaySnapshot={activeReplay.snapshot}
        selectedReplayFlightId={replayMode === "simulation" ? selectedSimulationFlightId : selectedAdsbFlightId}
        flightAltitudeRange={flightAltitudeRange}
        flightOperationVisibility={flightOperationVisibility}
        simulationConflictPreview={simulationConflictPreview}
      />

      <div className="parent-pane page-pane page-pane-left flight-details-pane" aria-label="Left panels">
        {selectedAdsbFlight ? (
          <AdsbFlightDetailsPanel
            flight={selectedAdsbFlight}
            currentReplayTime={effectiveReplayTime}
            onClose={deselectAdsbFlight}
          />
        ) : null}
        {selectedSimulationFlight ? (
          <SimulationFlightDetailsPanel
            flight={selectedSimulationFlight}
            currentSimulationTime={effectiveReplayTime}
            onClose={deselectSimulationFlight}
            onSelectFix={selectFixFromFlightDetails}
          />
        ) : null}
        {replayMode === "simulation" && showFeasibilityPanel ? (
          <SimulationFeasibilityPanel
            refreshToken={simulationEvalRefreshToken}
            onClose={closeFeasibilityPanel}
            onSelectFlight={selectSimulationFlightFromEval}
          />
        ) : null}
        {replayMode === "simulation" && showConflictsPanel ? (
          <SimulationConflictsPanel
            refreshToken={simulationEvalRefreshToken}
            conflictViewEnabled={conflictViewEnabled}
            onClose={closeConflictsPanel}
            onConflictViewEnabledChange={setConflictViewEnabled}
            onConflictsChange={setSimulationConflicts}
            onSelectConflict={selectSimulationConflict}
          />
        ) : null}
      </div>

      <div className="parent-pane page-pane page-pane-right" aria-label="Right panels">
        {showChat ? <ChatPanel /> : null}
      </div>

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
          replayMinTime={activeReplay.metadata?.minTime ?? 0}
          replayMaxTime={activeReplay.metadata?.maxTime ?? 0}
          replayPlaying={replayPlaying}
          replaySpeed={replaySpeed}
          replayLoading={activeReplay.loading}
          flightAltitudeRange={flightAltitudeRange}
          flightOperationVisibility={flightOperationVisibility}
          onReplayTimeChange={(time) => {
            setReplayPlaying(false);
            setActiveReplayTime(time);
          }}
          onToggleReplayPlaying={() => setReplayPlaying((previous) => !previous)}
          onReplaySpeedChange={setReplaySpeed}
          onFlightAltitudeRangeChange={setFlightAltitudeRange}
          onFlightOperationVisibilityChange={setFlightOperationVisibility}
        />
      </div>
    </main>
  );
}
