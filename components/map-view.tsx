"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { buildLinkData, buildSearchItems, fitDataBounds, parseRunwayInfoText } from "./map-view-data";
import {
  addAdsbReplayLayers,
  addLinkLayers,
  addRulerLayers,
  addRunwayLayers,
  addVorLayers,
  addWaypointLayers,
  setLinkVisibility,
  setWaypointVisibility,
  updateAdsbReplayLayers,
  updateRulerLayers,
} from "./map-view-layers";
import type { MapCoordinate, MapSearchItem } from "./map-view-types";
import { interpolateFlightAtTime } from "@/components/adsb-replay/interpolate";
import type { ReplayFlight, ReplayMode, ReplaySnapshot } from "@/components/adsb-replay/types";

export type { MapCoordinate, MapSearchItem } from "./map-view-types";

type FixSearchItem = Extract<MapSearchItem, { type: "Waypoint" | "VOR" | "Runway" }>;

type MapViewProps = {
  showWaypoints: boolean;
  showLinks: boolean;
  rulerActive: boolean;
  rulerPoints: MapCoordinate[];
  onAddRulerPoint: (point: MapCoordinate) => void;
  selectedSearchTarget: { id: string; requestId: number; time?: number } | null;
  onSelectReplayFlight?: (flightId: string) => void;
  onSearchItemsChange: (items: MapSearchItem[]) => void;
  replayMode: ReplayMode;
  replayFlights: ReplayFlight[];
  replaySnapshot: ReplaySnapshot;
  selectedReplayFlightId?: string | null;
};

const BASE_MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export default function MapView({
  showWaypoints,
  showLinks,
  rulerActive,
  rulerPoints,
  onAddRulerPoint,
  selectedSearchTarget,
  onSelectReplayFlight,
  onSearchItemsChange,
  replayMode,
  replayFlights,
  replaySnapshot,
  selectedReplayFlightId = null,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const showWaypointsRef = useRef(showWaypoints);
  const showLinksRef = useRef(showLinks);
  const rulerActiveRef = useRef(rulerActive);
  const onAddRulerPointRef = useRef(onAddRulerPoint);
  const onSelectReplayFlightRef = useRef(onSelectReplayFlight);
  const replayModeRef = useRef(replayMode);
  const replayFlightsRef = useRef(replayFlights);
  const replaySnapshotRef = useRef(replaySnapshot);
  const selectedReplayFlightIdRef = useRef(selectedReplayFlightId);
  const searchItemsRef = useRef<FixSearchItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    showWaypointsRef.current = showWaypoints;
  }, [showWaypoints]);

  useEffect(() => {
    showLinksRef.current = showLinks;
  }, [showLinks]);

  useEffect(() => {
    rulerActiveRef.current = rulerActive;
  }, [rulerActive]);

  useEffect(() => {
    onAddRulerPointRef.current = onAddRulerPoint;
  }, [onAddRulerPoint]);

  useEffect(() => {
    onSelectReplayFlightRef.current = onSelectReplayFlight;
  }, [onSelectReplayFlight]);

  useEffect(() => {
    replayModeRef.current = replayMode;
    replayFlightsRef.current = replayFlights;
    replaySnapshotRef.current = replaySnapshot;
    selectedReplayFlightIdRef.current = selectedReplayFlightId;
  }, [replayFlights, replayMode, replaySnapshot, selectedReplayFlightId]);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      const maplibregl = await import("maplibre-gl");

      if (cancelled || !containerRef.current) {
        return;
      }

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: BASE_MAP_STYLE,
        center: [-97.04, 32.9],
        zoom: 6.8,
        fadeDuration: 0,
      });

      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("click", (event: MapMouseEvent) => {
        if (rulerActiveRef.current) {
          event.preventDefault();
          onAddRulerPointRef.current([event.lngLat.lng, event.lngLat.lat]);
          return;
        }

        if (!map.getLayer("adsb-aircraft-layer")) {
          return;
        }

        const aircraftFeatures = map.queryRenderedFeatures(event.point, {
          layers: ["adsb-aircraft-layer"],
        });
        const flightId = aircraftFeatures[0]?.properties?.flightId;
        if (typeof flightId === "string") {
          onSelectReplayFlightRef.current?.(flightId);
        }
      });
      map.on("moveend", () => {
        updateAdsbReplayLayers(
          map,
          replayModeRef.current,
          replayFlightsRef.current,
          replaySnapshotRef.current,
          selectedReplayFlightIdRef.current,
        );
      });

      try {
        const [fixesResponse, runwayResponse, linkResponse] = await Promise.all([
          fetch("/data/airport_related_fixes.csv", { cache: "force-cache" }),
          fetch("/data/kdfw-runways.txt", { cache: "force-cache" }),
          fetch("/data/airport_related.csv", { cache: "force-cache" }),
        ]);

        if (!fixesResponse.ok) {
          throw new Error(`Failed to load CSV (${fixesResponse.status})`);
        }
        if (!runwayResponse.ok) {
          throw new Error(`Failed to load runway data (${runwayResponse.status})`);
        }
        if (!linkResponse.ok) {
          throw new Error(`Failed to load link data (${linkResponse.status})`);
        }

        const [csvText, runwayText, linkText] = await Promise.all([
          fixesResponse.text(),
          runwayResponse.text(),
          linkResponse.text(),
        ]);
        const runways = parseRunwayInfoText(runwayText);
        const linkData = buildLinkData(csvText, linkText);
        if (runways.features.length === 0) {
          throw new Error("No runway data loaded");
        }
        if (cancelled) {
          return;
        }
        const searchItems = buildSearchItems(linkData.waypoints, linkData.vors, runways);
        searchItemsRef.current = searchItems;
        onSearchItemsChange(searchItems);

        const addMapLayers = () => {
          addRunwayLayers(map, runways);
          addLinkLayers(map, linkData.links, showLinksRef.current);
          addWaypointLayers(map, linkData.waypoints, showWaypointsRef.current);
          addVorLayers(map, linkData.vors);
          addRulerLayers(map, [], rulerActiveRef.current);
          addAdsbReplayLayers(map, replayModeRef.current === "adsb");
          updateAdsbReplayLayers(
            map,
            replayModeRef.current,
            replayFlightsRef.current,
            replaySnapshotRef.current,
            selectedReplayFlightIdRef.current,
          );
          fitDataBounds(map, maplibregl, linkData.waypoints, linkData.vors, runways);
        };

        if (map.loaded()) {
          addMapLayers();
        } else {
          map.once("load", addMapLayers);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "Failed to load map data");
      }
    }

    void initializeMap();

    return () => {
      cancelled = true;
      onSearchItemsChange([]);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [onSearchItemsChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    updateRulerLayers(map, rulerPoints, rulerActive);
    map.getCanvas().style.cursor = rulerActive ? "crosshair" : "";
  }, [rulerActive, rulerPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    setWaypointVisibility(map, showWaypoints);
  }, [showWaypoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    setLinkVisibility(map, showLinks);
  }, [showLinks]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    updateAdsbReplayLayers(map, replayMode, replayFlights, replaySnapshot, selectedReplayFlightId);
  }, [replayFlights, replayMode, replaySnapshot, selectedReplayFlightId]);

  useEffect(() => {
    if (!selectedSearchTarget) {
      return;
    }

    const map = mapRef.current;
    if (!map) {
      return;
    }

    const item = searchItemsRef.current.find((searchItem) => searchItem.id === selectedSearchTarget.id);
    if (item) {
      map.flyTo({
        center: item.coordinates,
        zoom: Math.max(map.getZoom(), item.zoom),
        speed: 0.9,
        curve: 1.25,
        essential: true,
      });
      return;
    }

    const flight = replayFlightsRef.current.find((replayFlight) => `flight:${replayFlight.id}` === selectedSearchTarget.id);
    const targetTime = selectedSearchTarget.time ?? flight?.firstTime;
    const aircraft = flight && targetTime !== undefined ? interpolateFlightAtTime(flight, targetTime) : null;
    if (!aircraft) {
      return;
    }

    map.flyTo({
      center: aircraft.coordinate,
      zoom: Math.max(map.getZoom(), 9),
      speed: 0.9,
      curve: 1.25,
      essential: true,
    });
  }, [selectedSearchTarget]);

  return (
    <section className="map-shell" aria-label="Arrivals map">
      <div ref={containerRef} className="map-canvas" />
      {errorMessage ? <div className="map-info-badge">Map data load error: {errorMessage}</div> : null}
    </section>
  );
}
