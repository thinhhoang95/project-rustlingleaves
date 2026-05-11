import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { buildAircraftCollection, buildVisibleFlightLineCollection } from "@/components/adsb-replay/geojson";
import type {
  AircraftFeatureCollection,
  FlightLineFeatureCollection,
  ReplayFlight,
  ReplayMode,
  ReplaySnapshot,
} from "@/components/adsb-replay/types";
import { buildRulerCollection } from "./map-view-data";
import type {
  AirportPointCollection,
  LinkCollection,
  RunwayCollection,
} from "./map-view-data";
import type { MapCoordinate } from "./map-view-types";

const WAYPOINT_SOURCE_ID = "arrival-waypoints-source";
const VOR_SOURCE_ID = "arrival-vor-source";
const RUNWAY_SOURCE_ID = "arrival-runway-source";
const LINK_SOURCE_ID = "arrival-links-source";
const WAYPOINT_CIRCLE_LAYER_ID = "arrival-waypoints-circle-layer";
const VOR_CIRCLE_LAYER_ID = "arrival-vor-circle-layer";
const RUNWAY_LINE_LAYER_ID = "arrival-runway-line-layer";
const LINK_LINE_LAYER_ID = "arrival-links-line-layer";
const LINK_ARROW_LAYER_ID = "arrival-links-arrow-layer";
const LINK_ARROW_IMAGE_ID = "arrival-link-arrowhead";
const WAYPOINT_LABEL_LAYER_ID = "arrival-waypoints-label-layer";
const VOR_LABEL_LAYER_ID = "arrival-vor-label-layer";
const RUNWAY_LABEL_LAYER_ID = "arrival-runway-label-layer";
const RULER_SOURCE_ID = "arrival-ruler-source";
const RULER_LINE_LAYER_ID = "arrival-ruler-line-layer";
const RULER_POINT_LAYER_ID = "arrival-ruler-point-layer";
const AIRCRAFT_SOURCE_ID = "adsb-aircraft-source";
const FLIGHT_LINE_SOURCE_ID = "adsb-flight-lines-source";
const AIRCRAFT_LAYER_ID = "adsb-aircraft-layer";
const AIRCRAFT_LABEL_LAYER_ID = "adsb-aircraft-label-layer";
const FLIGHT_LINE_LAYER_ID = "adsb-flight-lines-layer";
const AIRCRAFT_ICON_ID = "adsb-aircraft-icon";

function emptyAircraftCollection(): AircraftFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function emptyFlightLineCollection(): FlightLineFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function setLayerVisibility(map: MapLibreMap, layerId: string, visible: boolean) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }
}

function placeLinkLayersBelowReplayLayers(map: MapLibreMap) {
  if (!map.getLayer(LINK_LINE_LAYER_ID) || !map.getLayer(FLIGHT_LINE_LAYER_ID)) {
    return;
  }

  map.moveLayer(LINK_LINE_LAYER_ID, FLIGHT_LINE_LAYER_ID);

  if (!map.getLayer(LINK_ARROW_LAYER_ID)) {
    return;
  }

  map.moveLayer(LINK_ARROW_LAYER_ID, FLIGHT_LINE_LAYER_ID);
}

function addLinkArrowImage(map: MapLibreMap) {
  if (map.hasImage(LINK_ARROW_IMAGE_ID)) {
    return;
  }

  const scale = window.devicePixelRatio || 1;
  const width = 28;
  const height = 20;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.scale(scale, scale);
  context.lineCap = "round";
  context.lineJoin = "round";

  context.beginPath();
  context.moveTo(5, 4);
  context.lineTo(22, 10);
  context.lineTo(5, 16);
  context.strokeStyle = "rgba(47, 17, 32, 0.86)";
  context.lineWidth = 6;
  context.stroke();

  context.beginPath();
  context.moveTo(5, 4);
  context.lineTo(22, 10);
  context.lineTo(5, 16);
  context.strokeStyle = "#8b123d";
  context.lineWidth = 3.2;
  context.stroke();

  map.addImage(LINK_ARROW_IMAGE_ID, context.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: scale,
  });
}

function addAircraftImage(map: MapLibreMap) {
  if (map.hasImage(AIRCRAFT_ICON_ID)) {
    return;
  }

  const scale = window.devicePixelRatio || 1;
  const size = 34;
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.scale(scale, scale);
  context.translate(size / 2, size / 2);
  context.beginPath();
  context.moveTo(0, -13);
  context.lineTo(6, 9);
  context.lineTo(0, 5);
  context.lineTo(-6, 9);
  context.closePath();
  context.fillStyle = "#f8fafc";
  context.strokeStyle = "#07111f";
  context.lineWidth = 2.5;
  context.stroke();
  context.fill();

  map.addImage(AIRCRAFT_ICON_ID, context.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: scale,
  });
}

export function addWaypointLayers(
  map: MapLibreMap,
  waypoints: AirportPointCollection,
  visible: boolean,
) {
  if (!map.getSource(WAYPOINT_SOURCE_ID)) {
    map.addSource(WAYPOINT_SOURCE_ID, {
      type: "geojson",
      data: waypoints,
    });
  }

  if (!map.getLayer(WAYPOINT_CIRCLE_LAYER_ID)) {
    map.addLayer({
      id: WAYPOINT_CIRCLE_LAYER_ID,
      type: "circle",
      source: WAYPOINT_SOURCE_ID,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 2.5, 8, 3.25, 12, 4.75, 16, 6],
        "circle-color": "#f59e0b",
        "circle-stroke-color": "#0f172a",
        "circle-stroke-width": 1.25,
        "circle-opacity": 0.96,
      },
      layout: {
        visibility: visible ? "visible" : "none",
      },
    });
  }

  if (!map.getLayer(WAYPOINT_LABEL_LAYER_ID)) {
    map.addLayer({
      id: WAYPOINT_LABEL_LAYER_ID,
      type: "symbol",
      source: WAYPOINT_SOURCE_ID,
      minzoom: 6,
      layout: {
        "text-field": ["coalesce", ["get", "label"], ["get", "name"], ["get", "identifier"], ["get", "airportIcao"]],
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 9, 12, 11, 16, 13],
        "text-offset": [0, -1.15],
        "text-anchor": "bottom",
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        visibility: visible ? "visible" : "none",
      },
      paint: {
        "text-color": "#fbbf24",
        "text-halo-color": "#0b1120",
        "text-halo-width": 2,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.72, 10, 0.92, 14, 1],
      },
    });
  }
}

export function addVorLayers(map: MapLibreMap, vors: AirportPointCollection) {
  if (!map.getSource(VOR_SOURCE_ID)) {
    map.addSource(VOR_SOURCE_ID, {
      type: "geojson",
      data: vors,
    });
  }

  if (!map.getLayer(VOR_CIRCLE_LAYER_ID)) {
    map.addLayer({
      id: VOR_CIRCLE_LAYER_ID,
      type: "circle",
      source: VOR_SOURCE_ID,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 2.1, 8, 2.8, 12, 4, 16, 5.25],
        "circle-color": "#22d3ee",
        "circle-stroke-color": "#07111f",
        "circle-stroke-width": 1.1,
        "circle-opacity": 0.96,
      },
      layout: {
        visibility: "visible",
      },
    });
  }

  if (!map.getLayer(VOR_LABEL_LAYER_ID)) {
    map.addLayer({
      id: VOR_LABEL_LAYER_ID,
      type: "symbol",
      source: VOR_SOURCE_ID,
      minzoom: 6,
      layout: {
        "text-field": ["coalesce", ["get", "label"], ["get", "identifier"]],
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 8.5, 12, 10.5, 16, 12],
        "text-offset": [0, -0.95],
        "text-anchor": "bottom",
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        visibility: "visible",
      },
      paint: {
        "text-color": "#67e8f9",
        "text-halo-color": "#07111f",
        "text-halo-width": 2,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.7, 10, 0.9, 14, 1],
      },
    });
  }
}

export function addRunwayLayers(map: MapLibreMap, runways: RunwayCollection) {
  if (!map.getSource(RUNWAY_SOURCE_ID)) {
    map.addSource(RUNWAY_SOURCE_ID, {
      type: "geojson",
      data: runways,
    });
  }

  if (!map.getLayer(RUNWAY_LINE_LAYER_ID)) {
    map.addLayer({
      id: RUNWAY_LINE_LAYER_ID,
      type: "line",
      source: RUNWAY_SOURCE_ID,
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#22c55e",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.85, 8, 1.1, 12, 1.7, 16, 2.2],
        "line-opacity": 0.88,
      },
    });
  }

  if (!map.getLayer(RUNWAY_LABEL_LAYER_ID)) {
    map.addLayer({
      id: RUNWAY_LABEL_LAYER_ID,
      type: "symbol",
      source: RUNWAY_SOURCE_ID,
      minzoom: 7,
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "label"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 8.5, 12, 10, 16, 11],
        "text-keep-upright": true,
        "text-allow-overlap": true,
        "text-font": ["Noto Sans Regular"],
        visibility: "visible",
      },
      paint: {
        "text-color": "#86efac",
        "text-halo-color": "#07111f",
        "text-halo-width": 1.6,
      },
    });
  }
}

export function addLinkLayers(map: MapLibreMap, links: LinkCollection, visible: boolean) {
  if (!map.getSource(LINK_SOURCE_ID)) {
    map.addSource(LINK_SOURCE_ID, {
      type: "geojson",
      data: links,
    });
  }

  if (!map.getLayer(LINK_LINE_LAYER_ID)) {
    map.addLayer({
      id: LINK_LINE_LAYER_ID,
      type: "line",
      source: LINK_SOURCE_ID,
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: visible ? "visible" : "none",
      },
      paint: {
        "line-color": "#8b123d",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.7, 9, 1.1, 12, 1.6, 16, 2.3],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.48, 9, 0.64, 14, 0.8],
      },
    });
  }

  addLinkArrowImage(map);

  if (!map.getLayer(LINK_ARROW_LAYER_ID)) {
    map.addLayer({
      id: LINK_ARROW_LAYER_ID,
      type: "symbol",
      source: LINK_SOURCE_ID,
      minzoom: 5,
      layout: {
        "symbol-placement": "line-center",
        "icon-image": LINK_ARROW_IMAGE_ID,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.34, 10, 0.43, 14, 0.55],
        "icon-keep-upright": false,
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        visibility: visible ? "visible" : "none",
      },
    });
  }
}

export function setWaypointVisibility(map: MapLibreMap, visible: boolean) {
  setLayerVisibility(map, WAYPOINT_CIRCLE_LAYER_ID, visible);
  setLayerVisibility(map, WAYPOINT_LABEL_LAYER_ID, visible);
}

export function setLinkVisibility(map: MapLibreMap, visible: boolean) {
  setLayerVisibility(map, LINK_LINE_LAYER_ID, visible);
  setLayerVisibility(map, LINK_ARROW_LAYER_ID, visible);
}

export function addRulerLayers(map: MapLibreMap, points: MapCoordinate[], visible: boolean) {
  if (!map.getSource(RULER_SOURCE_ID)) {
    map.addSource(RULER_SOURCE_ID, {
      type: "geojson",
      data: buildRulerCollection(points),
    });
  }

  if (!map.getLayer(RULER_LINE_LAYER_ID)) {
    map.addLayer({
      id: RULER_LINE_LAYER_ID,
      type: "line",
      source: RULER_SOURCE_ID,
      filter: ["==", ["geometry-type"], "LineString"],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: visible ? "visible" : "none",
      },
      paint: {
        "line-color": "#fde047",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.6, 9, 2.4, 14, 3.4],
        "line-opacity": 0.92,
        "line-dasharray": [1.2, 0.65],
      },
    });
  }

  if (!map.getLayer(RULER_POINT_LAYER_ID)) {
    map.addLayer({
      id: RULER_POINT_LAYER_ID,
      type: "circle",
      source: RULER_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      layout: {
        visibility: visible ? "visible" : "none",
      },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4, 10, 5.5, 15, 7],
        "circle-color": "#fef08a",
        "circle-stroke-color": "#111827",
        "circle-stroke-width": 2,
        "circle-opacity": 0.98,
      },
    });
  }
}

export function updateRulerLayers(map: MapLibreMap, points: MapCoordinate[], visible: boolean) {
  addRulerLayers(map, points, visible);

  const source = map.getSource(RULER_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData(buildRulerCollection(points));

  setLayerVisibility(map, RULER_LINE_LAYER_ID, visible);
  setLayerVisibility(map, RULER_POINT_LAYER_ID, visible);
}

export function addAdsbReplayLayers(map: MapLibreMap, visible: boolean) {
  if (!map.getSource(FLIGHT_LINE_SOURCE_ID)) {
    map.addSource(FLIGHT_LINE_SOURCE_ID, {
      type: "geojson",
      data: emptyFlightLineCollection(),
    });
  }

  if (!map.getLayer(FLIGHT_LINE_LAYER_ID)) {
    map.addLayer({
      id: FLIGHT_LINE_LAYER_ID,
      type: "line",
      source: FLIGHT_LINE_SOURCE_ID,
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: visible ? "visible" : "none",
      },
      paint: {
        "line-color": "#38bdf8",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1, 8, 1.8, 12, 2.6, 16, 3.4],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.34, 8, 0.56, 12, 0.74],
      },
    });
  }

  if (!map.getSource(AIRCRAFT_SOURCE_ID)) {
    map.addSource(AIRCRAFT_SOURCE_ID, {
      type: "geojson",
      data: emptyAircraftCollection(),
    });
  }

  addAircraftImage(map);

  if (!map.getLayer(AIRCRAFT_LAYER_ID)) {
    map.addLayer({
      id: AIRCRAFT_LAYER_ID,
      type: "symbol",
      source: AIRCRAFT_SOURCE_ID,
      layout: {
        "icon-image": AIRCRAFT_ICON_ID,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 4, 0.48, 8, 0.62, 12, 0.78],
        "icon-rotate": ["get", "trackDegrees"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        visibility: visible ? "visible" : "none",
      },
    });
  }

  if (!map.getLayer(AIRCRAFT_LABEL_LAYER_ID)) {
    map.addLayer({
      id: AIRCRAFT_LABEL_LAYER_ID,
      type: "symbol",
      source: AIRCRAFT_SOURCE_ID,
      minzoom: 6,
      layout: {
        "text-field": ["format", ["get", "callsign"], {}, "\n", {}, ["get", "altitudeLabel"], {}],
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 9, 10, 10.5, 14, 12],
        "text-offset": [0, 1.45],
        "text-anchor": "top",
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        visibility: visible ? "visible" : "none",
      },
      paint: {
        "text-color": "#e0f2fe",
        "text-halo-color": "#06101a",
        "text-halo-width": 2,
      },
    });
  }
}

export function updateAdsbReplayLayers(
  map: MapLibreMap,
  replayMode: ReplayMode,
  replayFlights: ReplayFlight[],
  replaySnapshot: ReplaySnapshot,
  selectedReplayFlightId: string | null = null,
) {
  const visible = replayMode === "adsb" || replayMode === "simulation";
  addAdsbReplayLayers(map, visible);
  placeLinkLayersBelowReplayLayers(map);

  const aircraftSource = map.getSource(AIRCRAFT_SOURCE_ID) as GeoJSONSource | undefined;
  aircraftSource?.setData(visible ? buildAircraftCollection(replaySnapshot.aircraft) : emptyAircraftCollection());

  const flightLineSource = map.getSource(FLIGHT_LINE_SOURCE_ID) as GeoJSONSource | undefined;
  flightLineSource?.setData(
    visible
      ? buildVisibleFlightLineCollection(replayFlights, replaySnapshot.aircraft, selectedReplayFlightId)
      : emptyFlightLineCollection(),
  );

  setLayerVisibility(map, FLIGHT_LINE_LAYER_ID, visible);
  setLayerVisibility(map, AIRCRAFT_LAYER_ID, visible);
  setLayerVisibility(map, AIRCRAFT_LABEL_LAYER_ID, visible);
}
