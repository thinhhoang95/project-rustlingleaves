import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapCoordinate, MapSearchItem } from "./map-view-types";

type LinkSectionCode = "PE" | "PF";

export type AirportPointFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: MapCoordinate;
  };
  properties: {
    identifier: string;
    airportIcao: string;
    name: string;
    label: string;
  };
};

export type AirportPointCollection = {
  type: "FeatureCollection";
  features: AirportPointFeature[];
};

export type RunwayFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: MapCoordinate[];
  };
  properties: {
    identifier: string;
    lengthFt: number;
    label: string;
  };
};

export type RunwayCollection = {
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

export type LinkFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: MapCoordinate[];
  };
  properties: {
    fromIdentifier: string;
    toIdentifier: string;
  };
};

export type LinkCollection = {
  type: "FeatureCollection";
  features: LinkFeature[];
};

type LinkSegment = {
  fromIdentifier: string;
  toIdentifier: string;
};

export type LinkData = {
  waypoints: AirportPointCollection;
  vors: AirportPointCollection;
  links: LinkCollection;
};

export type RulerFeatureCollection = {
  type: "FeatureCollection";
  features: Array<
    | {
        type: "Feature";
        geometry: {
          type: "LineString";
          coordinates: MapCoordinate[];
        };
        properties: Record<string, never>;
      }
    | {
        type: "Feature";
        geometry: {
          type: "Point";
          coordinates: MapCoordinate;
        };
        properties: { index: number };
      }
  >;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
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
  coordinatesByIdentifier: Map<string, MapCoordinate>;
} {
  const rows = csvText
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  if (rows.length <= 1) {
    return {
      waypoints: { type: "FeatureCollection", features: [] },
      vors: { type: "FeatureCollection", features: [] },
      coordinatesByIdentifier: new Map<string, MapCoordinate>(),
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
      coordinatesByIdentifier: new Map<string, MapCoordinate>(),
    };
  }

  const waypointFeatures: AirportPointFeature[] = [];
  const vorFeatures: AirportPointFeature[] = [];
  const coordinatesByIdentifier = new Map<string, MapCoordinate>();

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

function buildLinkCollection(
  segments: LinkSegment[],
  coordinatesByIdentifier: Map<string, MapCoordinate>,
): LinkCollection {
  const features: LinkFeature[] = [];

  for (const segment of segments) {
    const fromCoordinates = coordinatesByIdentifier.get(segment.fromIdentifier);
    const toCoordinates = coordinatesByIdentifier.get(segment.toIdentifier);

    if (!fromCoordinates || !toCoordinates) {
      continue;
    }

    if (fromCoordinates[0] === toCoordinates[0] && fromCoordinates[1] === toCoordinates[1]) {
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

function getLineCenter(coordinates: MapCoordinate[]): MapCoordinate {
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

type BoundsLike = {
  getWest: () => number;
  getEast: () => number;
  getSouth: () => number;
  getNorth: () => number;
};

function isBoundsObject(bounds: unknown): bounds is BoundsLike {
  return (
    typeof bounds === "object" &&
    bounds !== null &&
    "getWest" in bounds &&
    "getEast" in bounds &&
    "getSouth" in bounds &&
    "getNorth" in bounds
  );
}

export function buildLinkData(fixesCsvText: string, linksCsvText: string): LinkData {
  const { segments, altitudeLabelsByIdentifier } = parseAirportRelatedLinkData(linksCsvText);
  const { waypoints, vors, coordinatesByIdentifier } = parseAirportFixesCsv(
    fixesCsvText,
    altitudeLabelsByIdentifier,
  );
  const links = buildLinkCollection(segments, coordinatesByIdentifier);
  return { waypoints, vors, links };
}

export function parseRunwayInfoText(text: string): RunwayCollection {
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
        [row.longitudeA, row.latitudeA] as MapCoordinate,
        [row.longitudeB, row.latitudeB] as MapCoordinate,
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

export function buildSearchItems(
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

export function fitDataBounds(
  map: MapLibreMap,
  maplibreglModule: typeof import("maplibre-gl"),
  waypoints: AirportPointCollection,
  vors: AirportPointCollection,
  runways: RunwayCollection,
) {
  const coordinates: MapCoordinate[] = [];

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

  if (!isBoundsObject(bounds)) {
    return;
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

export function buildRulerCollection(points: MapCoordinate[]): RulerFeatureCollection {
  const pointFeatures = points.map((coordinates, index) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates,
    },
    properties: { index },
  }));

  return {
    type: "FeatureCollection",
    features:
      points.length > 1
        ? [
            {
              type: "Feature" as const,
              geometry: {
                type: "LineString" as const,
                coordinates: points,
              },
              properties: {},
            },
            ...pointFeatures,
          ]
        : pointFeatures,
  };
}
