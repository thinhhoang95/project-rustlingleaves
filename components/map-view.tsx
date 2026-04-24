"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

type MapViewProps = {
  showWaypoints: boolean;
  showLinks: boolean;
  selectedSearchTarget: { id: string; requestId: number } | null;
  onSearchItemsChange: (items: MapSearchItem[]) => void;
};

type LinkSectionCode = "PE" | "PF";

type AirportPointFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    identifier: string;
    airportIcao: string;
    name: string;
    label: string;
  };
};

type AirportPointCollection = {
  type: "FeatureCollection";
  features: AirportPointFeature[];
};

type RunwayFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: {
    identifier: string;
    lengthFt: number;
    label: string;
  };
};

type RunwayCollection = {
  type: "FeatureCollection";
  features: RunwayFeature[];
};

type RunwayInfoRow = {
  runwayPair: string;
  lengthFt: number;
  latitudeA: number;
  longitudeA: number;
  latitudeB: number;
  longitudeB: number;
};

type LinkFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: {
    fromIdentifier: string;
    toIdentifier: string;
  };
};

type LinkCollection = {
  type: "FeatureCollection";
  features: LinkFeature[];
};

type LinkSegment = {
  fromIdentifier: string;
  toIdentifier: string;
};

export type MapSearchItem = {
  id: string;
  name: string;
  type: "Waypoint" | "VOR" | "Runway";
  coordinates: [number, number];
  zoom: number;
};

const BASE_MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
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

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function toIdentifierKey(identifier: string): string {
  return identifier.trim().toUpperCase();
}

function parseSequenceNumber(value: string): number {
  const parsedValue = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsedValue) ? parsedValue : Number.MAX_SAFE_INTEGER;
}

function parseAltitudeTokenToFlightLevel(value: string): number | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("FL")) {
    const flightLevelValue = Number(normalized.slice(2));
    return Number.isFinite(flightLevelValue) ? Math.round(flightLevelValue) : null;
  }

  const numericValue = Number(normalized);
  if (Number.isFinite(numericValue)) {
    return Math.round(numericValue / 100);
  }

  const digitsOnly = normalized.replace(/[^\d]/g, "");
  if (!digitsOnly) {
    return null;
  }

  const feetValue = Number(digitsOnly);
  return Number.isFinite(feetValue) ? Math.round(feetValue / 100) : null;
}

function formatFlightLevel(flightLevel: number): string {
  return `FL${Math.max(0, Math.round(flightLevel))
    .toString()
    .padStart(3, "0")}`;
}

function buildPointLabel(identifier: string, altitudeLabel: string | undefined): string {
  return altitudeLabel ? `${identifier}\n${altitudeLabel}` : identifier;
}

function parseAirportRelatedLinkData(
  csvText: string,
): {
  segments: LinkSegment[];
  altitudeLabelsByIdentifier: Map<string, string>;
} {
  const rows = csvText
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  if (rows.length <= 1) {
    return {
      segments: [],
      altitudeLabelsByIdentifier: new Map<string, string>(),
    };
  }

  const header = parseCsvLine(rows[0]).map((column) => column.trim());
  const indexByName = new Map<string, number>();
  header.forEach((name, index) => indexByName.set(name, index));

  const sectionCodeIndex = indexByName.get("section_code");
  const procedureIndex = indexByName.get("sid_star_approach_identifier");
  const routeTypeIndex = indexByName.get("route_type");
  const transitionIdentifierIndex = indexByName.get("transition_identifier");
  const sequenceNumberIndex = indexByName.get("sequence_number");
  const fixIdentifierIndex = indexByName.get("fix_identifier");
  const altitudeIndex = indexByName.get("altitude");
  const altitude2Index = indexByName.get("altitude_2");

  if (
    sectionCodeIndex === undefined ||
    procedureIndex === undefined ||
    routeTypeIndex === undefined ||
    transitionIdentifierIndex === undefined ||
    sequenceNumberIndex === undefined ||
    fixIdentifierIndex === undefined ||
    altitudeIndex === undefined ||
    altitude2Index === undefined
  ) {
    return {
      segments: [],
      altitudeLabelsByIdentifier: new Map<string, string>(),
    };
  }

  const groupedRows = new Map<string, Array<{ sequenceNumber: number; identifier: string }>>();
  const altitudeBoundsByIdentifier = new Map<string, { min: number; max: number }>();

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const columns = parseCsvLine(rows[rowIndex]);
    const sectionCode = columns[sectionCodeIndex]?.trim().toUpperCase() as LinkSectionCode | "";
    if (sectionCode !== "PE" && sectionCode !== "PF") {
      continue;
    }

    const identifier = columns[fixIdentifierIndex]?.trim() ?? "";
    const identifierKey = toIdentifierKey(identifier);
    if (!identifierKey) {
      continue;
    }

    const procedure = columns[procedureIndex]?.trim() ?? "";
    const routeType = columns[routeTypeIndex]?.trim() ?? "";
    const transitionIdentifier = columns[transitionIdentifierIndex]?.trim() || "ALL";
    const sequenceNumber = parseSequenceNumber(columns[sequenceNumberIndex] ?? "");
    const groupKey = `${sectionCode}::${procedure}::${routeType}::${transitionIdentifier}`;

    const existingGroup = groupedRows.get(groupKey);
    const groupEntries = existingGroup ?? [];
    groupEntries.push({ sequenceNumber, identifier: identifierKey });
    if (!existingGroup) {
      groupedRows.set(groupKey, groupEntries);
    }

    const altitudeValues = [columns[altitudeIndex] ?? "", columns[altitude2Index] ?? ""];
    for (const altitudeValue of altitudeValues) {
      const flightLevel = parseAltitudeTokenToFlightLevel(altitudeValue);
      if (flightLevel === null) {
        continue;
      }

      const existingBounds = altitudeBoundsByIdentifier.get(identifierKey);
      if (!existingBounds) {
        altitudeBoundsByIdentifier.set(identifierKey, { min: flightLevel, max: flightLevel });
      } else {
        existingBounds.min = Math.min(existingBounds.min, flightLevel);
        existingBounds.max = Math.max(existingBounds.max, flightLevel);
      }
    }
  }

  const segmentKeys = new Set<string>();
  const segments: LinkSegment[] = [];
  for (const groupedEntries of groupedRows.values()) {
    groupedEntries.sort((left, right) => left.sequenceNumber - right.sequenceNumber);

    const deduplicatedIdentifiers: string[] = [];
    for (const entry of groupedEntries) {
      const previousIdentifier = deduplicatedIdentifiers[deduplicatedIdentifiers.length - 1];
      if (previousIdentifier === entry.identifier) {
        continue;
      }
      deduplicatedIdentifiers.push(entry.identifier);
    }

    for (let index = 0; index < deduplicatedIdentifiers.length - 1; index += 1) {
      const fromIdentifier = deduplicatedIdentifiers[index];
      const toIdentifier = deduplicatedIdentifiers[index + 1];
      const segmentKey = `${fromIdentifier}->${toIdentifier}`;

      if (segmentKeys.has(segmentKey)) {
        continue;
      }

      segmentKeys.add(segmentKey);
      segments.push({ fromIdentifier, toIdentifier });
    }
  }

  const altitudeLabelsByIdentifier = new Map<string, string>();
  for (const [identifier, bounds] of altitudeBoundsByIdentifier.entries()) {
    const low = Math.min(bounds.min, bounds.max);
    const high = Math.max(bounds.min, bounds.max);
    const label = low === high ? formatFlightLevel(low) : `${formatFlightLevel(low)}-${formatFlightLevel(high)}`;
    altitudeLabelsByIdentifier.set(identifier, label);
  }

  return {
    segments,
    altitudeLabelsByIdentifier,
  };
}

function parseAirportFixesCsv(
  csvText: string,
  altitudeLabelsByIdentifier: Map<string, string>,
): {
  waypoints: AirportPointCollection;
  vors: AirportPointCollection;
  coordinatesByIdentifier: Map<string, [number, number]>;
} {
  const rows = csvText
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  if (rows.length <= 1) {
    return {
      waypoints: { type: "FeatureCollection", features: [] },
      vors: { type: "FeatureCollection", features: [] },
      coordinatesByIdentifier: new Map<string, [number, number]>(),
    };
  }

  const header = parseCsvLine(rows[0]).map((column) => column.trim());
  const indexByName = new Map<string, number>();
  header.forEach((name, index) => indexByName.set(name, index));

  const fixTypeIndex = indexByName.get("fix_type");
  const identifierIndex = indexByName.get("identifier");
  const airportIcaoIndex = indexByName.get("airport_icao");
  const latitudeIndex = indexByName.get("latitude_deg");
  const longitudeIndex = indexByName.get("longitude_deg");

  if (
    fixTypeIndex === undefined ||
    identifierIndex === undefined ||
    airportIcaoIndex === undefined ||
    latitudeIndex === undefined ||
    longitudeIndex === undefined
  ) {
    return {
      waypoints: { type: "FeatureCollection", features: [] },
      vors: { type: "FeatureCollection", features: [] },
      coordinatesByIdentifier: new Map<string, [number, number]>(),
    };
  }

  const waypointFeatures: AirportPointFeature[] = [];
  const vorFeatures: AirportPointFeature[] = [];
  const coordinatesByIdentifier = new Map<string, [number, number]>();

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const columns = parseCsvLine(rows[rowIndex]);
    const identifier = columns[identifierIndex]?.trim() ?? "";
    const identifierKey = toIdentifierKey(identifier);
    if (!identifierKey) {
      continue;
    }

    const fixType = columns[fixTypeIndex]?.trim().toLowerCase();
    const latitude = Number(columns[latitudeIndex]);
    const longitude = Number(columns[longitudeIndex]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }

    if (!coordinatesByIdentifier.has(identifierKey)) {
      coordinatesByIdentifier.set(identifierKey, [longitude, latitude]);
    }

    if (fixType !== "waypoint" && fixType !== "vor") {
      continue;
    }

    const altitudeLabel = altitudeLabelsByIdentifier.get(identifierKey);
    const displayLabel = buildPointLabel(identifier, altitudeLabel);

    const feature = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      properties: {
        identifier,
        airportIcao: columns[airportIcaoIndex]?.trim() ?? "",
        name: identifier,
        label: displayLabel,
      },
    } satisfies AirportPointFeature;

    if (fixType === "waypoint") {
      waypointFeatures.push(feature);
    } else {
      vorFeatures.push(feature);
    }
  }

  return {
    waypoints: { type: "FeatureCollection", features: waypointFeatures },
    vors: { type: "FeatureCollection", features: vorFeatures },
    coordinatesByIdentifier,
  };
}

function parseRunwayInfoText(text: string): RunwayCollection {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  if (rows.length <= 1) {
    return { type: "FeatureCollection", features: [] };
  }

  const header = parseCsvLine(rows[0]).map((column) => column.trim());
  const indexByName = new Map<string, number>();
  header.forEach((name, index) => indexByName.set(name, index));

  const runwayPairIndex = indexByName.get("runway_pair");
  const lengthFtIndex = indexByName.get("length_ft");
  const latitudeAIndex = indexByName.get("latitude_a");
  const longitudeAIndex = indexByName.get("longitude_a");
  const latitudeBIndex = indexByName.get("latitude_b");
  const longitudeBIndex = indexByName.get("longitude_b");

  if (
    runwayPairIndex === undefined ||
    lengthFtIndex === undefined ||
    latitudeAIndex === undefined ||
    longitudeAIndex === undefined ||
    latitudeBIndex === undefined ||
    longitudeBIndex === undefined
  ) {
    return { type: "FeatureCollection", features: [] };
  }

  const parsedRows: RunwayInfoRow[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const columns = parseCsvLine(rows[rowIndex]);
    const runwayPair = columns[runwayPairIndex]?.trim();
    const lengthFt = Number(columns[lengthFtIndex]);
    const latitudeA = Number(columns[latitudeAIndex]);
    const longitudeA = Number(columns[longitudeAIndex]);
    const latitudeB = Number(columns[latitudeBIndex]);
    const longitudeB = Number(columns[longitudeBIndex]);

    if (
      !runwayPair ||
      !Number.isFinite(lengthFt) ||
      !Number.isFinite(latitudeA) ||
      !Number.isFinite(longitudeA) ||
      !Number.isFinite(latitudeB) ||
      !Number.isFinite(longitudeB)
    ) {
      continue;
    }

    parsedRows.push({
      runwayPair,
      lengthFt,
      latitudeA,
      longitudeA,
      latitudeB,
      longitudeB,
    });
  }

  const features: RunwayFeature[] = parsedRows.map((row) => ({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [row.longitudeA, row.latitudeA],
        [row.longitudeB, row.latitudeB],
      ],
    },
    properties: {
      identifier: row.runwayPair,
      lengthFt: row.lengthFt,
      label: `${row.runwayPair} - ${row.lengthFt.toLocaleString("en-US")} ft`,
    },
  }));

  return { type: "FeatureCollection", features };
}

function buildLinkCollection(
  segments: LinkSegment[],
  coordinatesByIdentifier: Map<string, [number, number]>,
): LinkCollection {
  const features: LinkFeature[] = [];

  for (const segment of segments) {
    const fromCoordinates = coordinatesByIdentifier.get(segment.fromIdentifier);
    const toCoordinates = coordinatesByIdentifier.get(segment.toIdentifier);

    if (!fromCoordinates || !toCoordinates) {
      continue;
    }

    if (
      fromCoordinates[0] === toCoordinates[0] &&
      fromCoordinates[1] === toCoordinates[1]
    ) {
      continue;
    }

    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [fromCoordinates, toCoordinates],
      },
      properties: {
        fromIdentifier: segment.fromIdentifier,
        toIdentifier: segment.toIdentifier,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

function buildLinkData(
  fixesCsvText: string,
  linksCsvText: string,
): {
  waypoints: AirportPointCollection;
  vors: AirportPointCollection;
  links: LinkCollection;
} {
  const { segments, altitudeLabelsByIdentifier } = parseAirportRelatedLinkData(linksCsvText);
  const { waypoints, vors, coordinatesByIdentifier } = parseAirportFixesCsv(
    fixesCsvText,
    altitudeLabelsByIdentifier,
  );
  const links = buildLinkCollection(segments, coordinatesByIdentifier);
  return { waypoints, vors, links };
}

function addWaypointLayers(map: MapLibreMap, waypoints: AirportPointCollection, visible: boolean) {
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
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          2.5,
          8,
          3.25,
          12,
          4.75,
          16,
          6,
        ],
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
}

function addWaypointLabelLayer(map: MapLibreMap, visible: boolean) {
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
        "text-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          0.72,
          10,
          0.92,
          14,
          1,
        ],
      },
    });
  }
}

function addVorLayers(map: MapLibreMap, vors: AirportPointCollection) {
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
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          2.1,
          8,
          2.8,
          12,
          4,
          16,
          5.25,
        ],
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
}

function addVorLabelLayer(map: MapLibreMap) {
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
        "text-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          0.7,
          10,
          0.9,
          14,
          1,
        ],
      },
    });
  }
}

function addRunwayLayers(map: MapLibreMap, runways: RunwayCollection) {
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
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0.85,
          8,
          1.1,
          12,
          1.7,
          16,
          2.2,
        ],
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
  context.strokeStyle = "#fda4af";
  context.lineWidth = 3.2;
  context.stroke();

  map.addImage(LINK_ARROW_IMAGE_ID, context.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: scale,
  });
}

function addLinkLayers(map: MapLibreMap, links: LinkCollection, visible: boolean) {
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
        "line-color": "#fda4af",
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

function setWaypointVisibility(map: MapLibreMap, visible: boolean) {
  if (map.getLayer(WAYPOINT_CIRCLE_LAYER_ID)) {
    map.setLayoutProperty(WAYPOINT_CIRCLE_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
  if (map.getLayer(WAYPOINT_LABEL_LAYER_ID)) {
    map.setLayoutProperty(WAYPOINT_LABEL_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

function setLinkVisibility(map: MapLibreMap, visible: boolean) {
  if (map.getLayer(LINK_LINE_LAYER_ID)) {
    map.setLayoutProperty(LINK_LINE_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
  if (map.getLayer(LINK_ARROW_LAYER_ID)) {
    map.setLayoutProperty(LINK_ARROW_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

function fitDataBounds(
  map: MapLibreMap,
  maplibreglModule: typeof import("maplibre-gl"),
  waypoints: AirportPointCollection,
  vors: AirportPointCollection,
  runways: RunwayCollection,
) {
  const coordinates: [number, number][] = [];

  for (const feature of waypoints.features) {
    coordinates.push(feature.geometry.coordinates);
  }
  for (const feature of vors.features) {
    coordinates.push(feature.geometry.coordinates);
  }
  for (const feature of runways.features) {
    coordinates.push(...feature.geometry.coordinates);
  }

  if (coordinates.length === 0) {
    return;
  }

  const [firstLongitude, firstLatitude] = coordinates[0];
  const bounds = new maplibreglModule.LngLatBounds(
    [firstLongitude, firstLatitude],
    [firstLongitude, firstLatitude],
  );

  for (let index = 1; index < coordinates.length; index += 1) {
    bounds.extend(coordinates[index]);
  }

  map.fitBounds(bounds, {
    duration: 0,
    maxZoom: 8,
    padding: {
      top: 110,
      right: 56,
      bottom: 140,
      left: 56,
    },
  });
}

function getLineCenter(coordinates: [number, number][]): [number, number] {
  if (coordinates.length === 0) {
    return [0, 0];
  }
  if (coordinates.length === 1) {
    return coordinates[0];
  }

  const [startLongitude, startLatitude] = coordinates[0];
  const [endLongitude, endLatitude] = coordinates[coordinates.length - 1];
  return [(startLongitude + endLongitude) / 2, (startLatitude + endLatitude) / 2];
}

function buildSearchItems(
  waypoints: AirportPointCollection,
  vors: AirportPointCollection,
  runways: RunwayCollection,
): MapSearchItem[] {
  const items: MapSearchItem[] = [];

  for (const feature of waypoints.features) {
    const identifier = feature.properties.identifier.trim();
    if (!identifier) {
      continue;
    }
    items.push({
      id: `waypoint:${toIdentifierKey(identifier)}`,
      name: identifier,
      type: "Waypoint",
      coordinates: feature.geometry.coordinates,
      zoom: 11.5,
    });
  }

  for (const feature of vors.features) {
    const identifier = feature.properties.identifier.trim();
    if (!identifier) {
      continue;
    }
    items.push({
      id: `vor:${toIdentifierKey(identifier)}`,
      name: identifier,
      type: "VOR",
      coordinates: feature.geometry.coordinates,
      zoom: 11.5,
    });
  }

  for (const feature of runways.features) {
    const identifier = feature.properties.identifier.trim();
    if (!identifier) {
      continue;
    }
    items.push({
      id: `runway:${toIdentifierKey(identifier)}`,
      name: identifier,
      type: "Runway",
      coordinates: getLineCenter(feature.geometry.coordinates),
      zoom: 13.2,
    });
  }

  return items.sort((left, right) => left.name.localeCompare(right.name));
}

export default function MapView({
  showWaypoints,
  showLinks,
  selectedSearchTarget,
  onSearchItemsChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const showWaypointsRef = useRef(showWaypoints);
  const showLinksRef = useRef(showLinks);
  const searchItemsRef = useRef<MapSearchItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    showWaypointsRef.current = showWaypoints;
  }, [showWaypoints]);

  useEffect(() => {
    showLinksRef.current = showLinks;
  }, [showLinks]);

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
      });

      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

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
          addWaypointLayers(map, linkData.waypoints, showWaypointsRef.current);
          addVorLayers(map, linkData.vors);
          addLinkLayers(map, linkData.links, showLinksRef.current);
          addWaypointLabelLayer(map, showWaypointsRef.current);
          addVorLabelLayer(map);
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
    if (!selectedSearchTarget) {
      return;
    }

    const map = mapRef.current;
    const item = searchItemsRef.current.find((searchItem) => searchItem.id === selectedSearchTarget.id);
    if (!map || !item) {
      return;
    }

    map.flyTo({
      center: item.coordinates,
      zoom: Math.max(map.getZoom(), item.zoom),
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
