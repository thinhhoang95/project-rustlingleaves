import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { AircraftState } from "@/components/adsb-replay/types";
import type { MapCoordinate } from "@/components/map-view-types";

export type SimulationConflictPreviewConfig = {
  enabled: boolean;
  conflicts: SimulationConflict[];
};

export type ConflictFlight = {
  flightNumber: string;
  flightId: string;
  runway: string;
};

export type SimulationConflict = {
  id: string;
  flightA: ConflictFlight;
  flightB: ConflictFlight;
  startTime: number;
  endTime: number;
  closestTime: number;
  closestTimeUtc: string;
  coordinate: MapCoordinate;
  lateralDistanceNmi: number;
  verticalSeparationFt: number;
  lateralThresholdNmi: number;
  verticalThresholdFt: number;
  envelopeRadiusNmi: number;
  severity: number;
  confidence: "confirmed" | "possible";
};

type ConflictPreviewStatus = "clear" | "conflict";

type SimulationConflictPreviewFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: MapCoordinate[];
  };
  properties: {
    flightId: string;
    callsign: string;
    radiusNmi: number;
    status: ConflictPreviewStatus;
    activeConflictCount: number;
  };
};

type SimulationConflictPreviewFeatureCollection = {
  type: "FeatureCollection";
  features: SimulationConflictPreviewFeature[];
};

const CONFLICT_PREVIEW_SOURCE_ID = "simulation-conflict-preview-source";
const CONFLICT_PREVIEW_LAYER_ID = "simulation-conflict-preview-layer";
const DEFAULT_CONFLICT_ENVELOPE_RADIUS_NMI = 5;
const CIRCLE_SEGMENT_COUNT = 96;
const NAUTICAL_MILES_TO_METERS = 1852;
const EARTH_RADIUS_METERS = 6371008.8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPositiveNumber(value: unknown): number | null {
  const number = readNumber(value);
  return number !== null && number > 0 ? number : null;
}

function clampSeverity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseConflictFlight(value: unknown): ConflictFlight | null {
  if (!isRecord(value)) {
    return null;
  }

  const flightId = readString(value.flight_id);
  const flightNumber = readString(value.flight_number) || flightId;

  if (!flightId || !flightNumber) {
    return null;
  }

  return {
    flightNumber,
    flightId,
    runway: readString(value.runway),
  };
}

function parseConflictConfidence(value: unknown): "confirmed" | "possible" {
  return readString(value).toLowerCase() === "possible" ? "possible" : "confirmed";
}

function parseEnvelopeRadiusNmi(item: Record<string, unknown>, lateralThresholdNmi: number): number {
  const explicitRadius =
    readPositiveNumber(item.envelope_radius_nmi) ??
    readPositiveNumber(item.cylinder_radius_nmi) ??
    readPositiveNumber(item.radius_nmi) ??
    readPositiveNumber(item.radius_nm);

  if (explicitRadius !== null) {
    return explicitRadius;
  }

  return lateralThresholdNmi > 0 ? lateralThresholdNmi / 2 : DEFAULT_CONFLICT_ENVELOPE_RADIUS_NMI;
}

export function parseSimulationConflicts(payload: unknown): SimulationConflict[] {
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected conflicts response");
  }

  return payload
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const flightA = parseConflictFlight(item.flight_a);
      const flightB = parseConflictFlight(item.flight_b);
      const latitude = readNumber(item.latitude);
      const longitude = readNumber(item.longitude);
      const closestTime = readNumber(item.closest_time);

      if (!flightA || !flightB || latitude === null || longitude === null || closestTime === null) {
        return null;
      }

      const startTime = readNumber(item.start_time) ?? closestTime;
      const endTime = readNumber(item.end_time) ?? closestTime;
      const lateralThresholdNmi = readNumber(item.lateral_threshold_nmi) ?? 10;
      const severity = clampSeverity(readNumber(item.severity) ?? 0);
      const id = [
        flightA.flightId,
        flightB.flightId,
        Math.round(closestTime),
        latitude.toFixed(5),
        longitude.toFixed(5),
      ].join(":");

      return {
        id,
        flightA,
        flightB,
        startTime,
        endTime,
        closestTime,
        closestTimeUtc: readString(item.closest_time_utc),
        coordinate: [longitude, latitude] as MapCoordinate,
        lateralDistanceNmi: readNumber(item.lateral_distance_nmi) ?? 0,
        verticalSeparationFt: readNumber(item.vertical_separation_ft) ?? 0,
        lateralThresholdNmi,
        verticalThresholdFt: readNumber(item.vertical_threshold_ft) ?? 1000,
        envelopeRadiusNmi: parseEnvelopeRadiusNmi(item, lateralThresholdNmi),
        severity,
        confidence: parseConflictConfidence(item.confidence),
      };
    })
    .filter((item): item is SimulationConflict => item !== null)
    .sort((left, right) => right.severity - left.severity || left.closestTime - right.closestTime);
}

function emptyConflictPreviewCollection(): SimulationConflictPreviewFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function isConflictActiveAtTime(conflict: SimulationConflict, time: number): boolean {
  const startTime = Math.min(conflict.startTime, conflict.endTime);
  const endTime = Math.max(conflict.startTime, conflict.endTime);
  return startTime <= time && time <= endTime;
}

function getFallbackEnvelopeRadiusNmi(conflicts: SimulationConflict[]): number {
  return conflicts.find((conflict) => conflict.envelopeRadiusNmi > 0)?.envelopeRadiusNmi ?? DEFAULT_CONFLICT_ENVELOPE_RADIUS_NMI;
}

function buildActiveConflictInfo(conflicts: SimulationConflict[], currentTime: number) {
  const activeConflictsByFlightId = new Map<string, { conflictCount: number; radiusNmi: number }>();

  for (const conflict of conflicts) {
    if (!isConflictActiveAtTime(conflict, currentTime)) {
      continue;
    }

    for (const flightId of [conflict.flightA.flightId, conflict.flightB.flightId]) {
      const currentInfo = activeConflictsByFlightId.get(flightId);
      activeConflictsByFlightId.set(flightId, {
        conflictCount: (currentInfo?.conflictCount ?? 0) + 1,
        radiusNmi: Math.max(currentInfo?.radiusNmi ?? 0, conflict.envelopeRadiusNmi),
      });
    }
  }

  return activeConflictsByFlightId;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function normalizeLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function calculateDestinationCoordinate(
  center: MapCoordinate,
  bearingDegrees: number,
  distanceMeters: number,
): MapCoordinate {
  const [longitude, latitude] = center;
  const latitudeRadians = toRadians(latitude);
  const longitudeRadians = toRadians(longitude);
  const bearingRadians = toRadians(bearingDegrees);
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;

  const destinationLatitudeRadians = Math.asin(
    Math.sin(latitudeRadians) * Math.cos(angularDistance) +
      Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearingRadians),
  );
  const destinationLongitudeRadians =
    longitudeRadians +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
      Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(destinationLatitudeRadians),
    );

  return [normalizeLongitude(toDegrees(destinationLongitudeRadians)), toDegrees(destinationLatitudeRadians)];
}

function buildEnvelopeCircleCoordinates(center: MapCoordinate, radiusNmi: number): MapCoordinate[] {
  const radiusMeters = Math.max(0, radiusNmi) * NAUTICAL_MILES_TO_METERS;
  const coordinates: MapCoordinate[] = [];

  for (let index = 0; index <= CIRCLE_SEGMENT_COUNT; index += 1) {
    coordinates.push(
      calculateDestinationCoordinate(center, (index / CIRCLE_SEGMENT_COUNT) * 360, radiusMeters),
    );
  }

  return coordinates;
}

export function buildSimulationConflictPreviewCollection(
  aircraft: AircraftState[],
  conflicts: SimulationConflict[],
  currentTime: number,
): SimulationConflictPreviewFeatureCollection {
  const activeConflictInfo = buildActiveConflictInfo(conflicts, currentTime);
  const fallbackRadiusNmi = getFallbackEnvelopeRadiusNmi(conflicts);

  return {
    type: "FeatureCollection",
    features: aircraft.map((state) => {
      const conflictInfo = activeConflictInfo.get(state.flightId);
      const status: ConflictPreviewStatus = conflictInfo ? "conflict" : "clear";
      const radiusNmi = conflictInfo?.radiusNmi ?? fallbackRadiusNmi;

      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: buildEnvelopeCircleCoordinates(state.coordinate, radiusNmi),
        },
        properties: {
          flightId: state.flightId,
          callsign: state.callsign,
          radiusNmi,
          status,
          activeConflictCount: conflictInfo?.conflictCount ?? 0,
        },
      };
    }),
  };
}

function setLayerVisibility(map: MapLibreMap, layerId: string, visible: boolean) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }
}

function addSimulationConflictPreviewLayer(
  map: MapLibreMap,
  visible: boolean,
  beforeLayerId?: string,
) {
  if (!map.getSource(CONFLICT_PREVIEW_SOURCE_ID)) {
    map.addSource(CONFLICT_PREVIEW_SOURCE_ID, {
      type: "geojson",
      data: emptyConflictPreviewCollection(),
    });
  }

  if (!map.getLayer(CONFLICT_PREVIEW_LAYER_ID)) {
    map.addLayer(
      {
        id: CONFLICT_PREVIEW_LAYER_ID,
        type: "line",
        source: CONFLICT_PREVIEW_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: visible ? "visible" : "none",
        },
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "status"], "conflict"],
            "#ef4444",
            "#22c55e",
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.1, 8, 1.6, 12, 2.1, 16, 2.8],
          "line-opacity": ["case", ["==", ["get", "status"], "conflict"], 0.95, 0.8],
          "line-dasharray": [2.1, 1.45],
        },
      },
      beforeLayerId && map.getLayer(beforeLayerId) ? beforeLayerId : undefined,
    );
  }
}

export function updateSimulationConflictPreviewLayers(
  map: MapLibreMap,
  visible: boolean,
  aircraft: AircraftState[],
  conflicts: SimulationConflict[],
  currentTime: number,
  beforeLayerId?: string,
) {
  addSimulationConflictPreviewLayer(map, visible, beforeLayerId);

  const source = map.getSource(CONFLICT_PREVIEW_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData(
    visible
      ? buildSimulationConflictPreviewCollection(aircraft, conflicts, currentTime)
      : emptyConflictPreviewCollection(),
  );

  setLayerVisibility(map, CONFLICT_PREVIEW_LAYER_ID, visible);
}
