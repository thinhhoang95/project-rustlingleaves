"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
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
import {
  clampFlightLevel,
  DEFAULT_FLIGHT_ALTITUDE_RANGE,
  type FlightAltitudeRange,
} from "@/components/adsb-replay/flight-altitude-filter";
import {
  DEFAULT_FLIGHT_OPERATION_VISIBILITY,
  type FlightOperationVisibility,
} from "@/components/adsb-replay/flight-line-colors";
import { useAdsbReplay } from "@/components/adsb-replay/useAdsbReplay";
import { useSimulationReplay } from "@/components/adsb-replay/useSimulationReplay";
import type { ReplayMode } from "@/components/adsb-replay/types";
import type {
  SimulationConflict,
  SimulationConflictPreviewConfig,
} from "@/components/simulation-conflict-preview";

const VIEW_SETTINGS_STORAGE_KEY = "rustling-leaves:view-settings:v1";
const DEFAULT_REPLAY_SPEED = 20;
const REPLAY_SPEEDS = [5, 10, 20] as const;

type PersistedViewSettings = {
  replaySpeed: number;
  showLinks: boolean;
  showWaypoints: boolean;
  flightAltitudeRange: FlightAltitudeRange;
  flightOperationVisibility: FlightOperationVisibility;
};

const DEFAULT_VIEW_SETTINGS: PersistedViewSettings = {
  replaySpeed: DEFAULT_REPLAY_SPEED,
  showLinks: true,
  showWaypoints: true,
  flightAltitudeRange: DEFAULT_FLIGHT_ALTITUDE_RANGE,
  flightOperationVisibility: DEFAULT_FLIGHT_OPERATION_VISIBILITY,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readReplaySpeed(value: unknown): number {
  return typeof value === "number" && REPLAY_SPEEDS.includes(value as (typeof REPLAY_SPEEDS)[number])
    ? value
    : DEFAULT_REPLAY_SPEED;
}

function readFlightAltitudeRange(value: unknown): FlightAltitudeRange {
  if (!isRecord(value)) {
    return DEFAULT_FLIGHT_ALTITUDE_RANGE;
  }

  const minFlightLevel =
    typeof value.minFlightLevel === "number"
      ? clampFlightLevel(value.minFlightLevel)
      : DEFAULT_FLIGHT_ALTITUDE_RANGE.minFlightLevel;
  const maxFlightLevel =
    typeof value.maxFlightLevel === "number"
      ? clampFlightLevel(value.maxFlightLevel)
      : DEFAULT_FLIGHT_ALTITUDE_RANGE.maxFlightLevel;

  return {
    minFlightLevel: Math.min(minFlightLevel, maxFlightLevel),
    maxFlightLevel: Math.max(minFlightLevel, maxFlightLevel),
  };
}

function readFlightOperationVisibility(value: unknown): FlightOperationVisibility {
  if (!isRecord(value)) {
    return DEFAULT_FLIGHT_OPERATION_VISIBILITY;
  }

  return {
    departure: readBoolean(value.departure, DEFAULT_FLIGHT_OPERATION_VISIBILITY.departure),
    arrival: readBoolean(value.arrival, DEFAULT_FLIGHT_OPERATION_VISIBILITY.arrival),
    unknown: readBoolean(value.unknown, DEFAULT_FLIGHT_OPERATION_VISIBILITY.unknown),
  };
}

function readPersistedViewSettings(): PersistedViewSettings | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedSettings = window.localStorage.getItem(VIEW_SETTINGS_STORAGE_KEY);
    if (!storedSettings) {
      return null;
    }

    const parsedSettings: unknown = JSON.parse(storedSettings);
    if (!isRecord(parsedSettings)) {
      return null;
    }

    return {
      replaySpeed: readReplaySpeed(parsedSettings.replaySpeed),
      showLinks: readBoolean(parsedSettings.showLinks, true),
      showWaypoints: readBoolean(parsedSettings.showWaypoints, true),
      flightAltitudeRange: readFlightAltitudeRange(parsedSettings.flightAltitudeRange),
      flightOperationVisibility: readFlightOperationVisibility(parsedSettings.flightOperationVisibility),
    };
  } catch {
    return null;
  }
}

function applySetStateAction<T>(value: SetStateAction<T>, previousValue: T): T {
  return typeof value === "function" ? (value as (previousValue: T) => T)(previousValue) : value;
}

export default function Page() {
  const [replayMode, setReplayMode] = useState<ReplayMode>("adsb");
  const [adsbReplayTime, setAdsbReplayTime] = useState(0);
  const [simulationReplayTime, setSimulationReplayTime] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [viewSettings, setViewSettings] = useState<PersistedViewSettings>(DEFAULT_VIEW_SETTINGS);
  const viewSettingsLoadedRef = useRef(false);
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
  const [runwayUseTimelineRequestToken, setRunwayUseTimelineRequestToken] = useState(0);
  const { replaySpeed, showLinks, showWaypoints, flightAltitudeRange, flightOperationVisibility } = viewSettings;
  const adsbReplay = useAdsbReplay(adsbReplayTime);
  const simulationReplay = useSimulationReplay(simulationReplayTime);
  const activeReplay = replayMode === "simulation" ? simulationReplay : adsbReplay;
  const setActiveReplayTime = replayMode === "simulation" ? setSimulationReplayTime : setAdsbReplayTime;
  const setReplaySpeed = useCallback((value: SetStateAction<number>) => {
    setViewSettings((previousSettings) => ({
      ...previousSettings,
      replaySpeed: applySetStateAction(value, previousSettings.replaySpeed),
    }));
  }, []);
  const setShowLinks = useCallback((value: SetStateAction<boolean>) => {
    setViewSettings((previousSettings) => ({
      ...previousSettings,
      showLinks: applySetStateAction(value, previousSettings.showLinks),
    }));
  }, []);
  const setShowWaypoints = useCallback((value: SetStateAction<boolean>) => {
    setViewSettings((previousSettings) => ({
      ...previousSettings,
      showWaypoints: applySetStateAction(value, previousSettings.showWaypoints),
    }));
  }, []);
  const setFlightAltitudeRange = useCallback((value: SetStateAction<FlightAltitudeRange>) => {
    setViewSettings((previousSettings) => ({
      ...previousSettings,
      flightAltitudeRange: applySetStateAction(value, previousSettings.flightAltitudeRange),
    }));
  }, []);
  const setFlightOperationVisibility = useCallback((value: SetStateAction<FlightOperationVisibility>) => {
    setViewSettings((previousSettings) => ({
      ...previousSettings,
      flightOperationVisibility: applySetStateAction(value, previousSettings.flightOperationVisibility),
    }));
  }, []);

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
    [searchItems, selectMapTarget, setShowWaypoints],
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
  const selectRunwayOccupancy = useCallback(
    (flightId: string, time: number) => {
      setReplayPlaying(false);
      setActiveReplayTime(time);

      if (replayMode === "simulation") {
        deselectAdsbFlight();
        selectSimulationFlight(flightId);
      } else {
        selectAdsbFlight(flightId);
        deselectSimulationFlight();
      }

      selectMapTarget(`flight:${flightId}`, time);
    },
    [
      deselectAdsbFlight,
      deselectSimulationFlight,
      replayMode,
      selectAdsbFlight,
      selectMapTarget,
      selectSimulationFlight,
      setActiveReplayTime,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const persistedSettings = readPersistedViewSettings();
      viewSettingsLoadedRef.current = true;
      if (persistedSettings) {
        setViewSettings(persistedSettings);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!viewSettingsLoadedRef.current) {
      return;
    }

    try {
      window.localStorage.setItem(VIEW_SETTINGS_STORAGE_KEY, JSON.stringify(viewSettings));
    } catch {
      // Ignore storage failures so private browsing or quota limits do not affect map controls.
    }
  }, [viewSettings]);

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
        onOpenRunwayUseTimeline={() => setRunwayUseTimelineRequestToken((token) => token + 1)}
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
          replayFlights={activeReplay.flights}
          runwayUseTimelineRequestToken={runwayUseTimelineRequestToken}
          flightAltitudeRange={flightAltitudeRange}
          flightOperationVisibility={flightOperationVisibility}
          onReplayTimeChange={(time) => {
            setReplayPlaying(false);
            setActiveReplayTime(time);
          }}
          onRunwayOccupancySelect={selectRunwayOccupancy}
          onToggleReplayPlaying={() => setReplayPlaying((previous) => !previous)}
          onReplaySpeedChange={setReplaySpeed}
          onFlightAltitudeRangeChange={setFlightAltitudeRange}
          onFlightOperationVisibilityChange={setFlightOperationVisibility}
        />
      </div>
    </main>
  );
}
