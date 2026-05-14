import type { CasProfilePoint, FinalFix, FlightPoint, ReplayFlight, ReplayMetadata, WaitAtcPoint } from "./types";

type RawFlight = {
  flight_id?: unknown;
  callsign?: unknown;
  icao24?: unknown;
  columns?: unknown;
  points?: unknown;
  first_time?: unknown;
  last_time?: unknown;
  departure_time?: unknown;
  departure_time_utc?: unknown;
  time_at_first_fix?: unknown;
  time_at_first_fix_utc?: unknown;
  time_at_last_event?: unknown;
  time_at_last_event_utc?: unknown;
  runway?: unknown;
  fix_sequence?: unknown;
  fix_count?: unknown;
  base_route?: unknown;
  atc_wait_point?: unknown;
  final_fix?: unknown;
  baseline_final_fix?: unknown;
  original_fix_sequence?: unknown;
  original_fix_count?: unknown;
  wait_atc_point?: unknown;
  cas_profile?: unknown;
};

const SECONDS_PER_DAY = 24 * 60 * 60;

function asFiniteNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}

function normalizeFixSequence(value: unknown): string[] | undefined {
  const fixSequence =
    typeof value === "string"
      ? value.split(">")
      : Array.isArray(value)
        ? value
        : undefined;

  if (!fixSequence) {
    return undefined;
  }

  const normalizedFixSequence = fixSequence
    .map((fixName) => String(fixName).trim())
    .filter(Boolean);

  return normalizedFixSequence.length ? normalizedFixSequence : undefined;
}

function normalizeBaseRoute(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function normalizeWaitAtcPoint(value: unknown): WaitAtcPoint | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const rawPoint = value as Record<string, unknown>;
  const source = rawPoint.source === "ghost" ? "ghost" : rawPoint.source === "fix" ? "fix" : undefined;
  const identifier = asTrimmedString(rawPoint.identifier);
  const latitude = asFiniteNumber(rawPoint.lat);
  const longitude = asFiniteNumber(rawPoint.lon);

  if (!source || !identifier || latitude === null || longitude === null) {
    return undefined;
  }

  return {
    source,
    identifier,
    latitude,
    longitude,
    lateralPathToken: asTrimmedString(rawPoint.lateral_path_token),
    distanceNm: asFiniteNumber(rawPoint.distance_nm) ?? undefined,
    routeIndex: asFiniteNumber(rawPoint.route_index),
    matchedCourseDegrees: asFiniteNumber(rawPoint.matched_course_deg),
    finalCourseDegrees: asFiniteNumber(rawPoint.final_course_deg) ?? undefined,
    downwindCourseDegrees: asFiniteNumber(rawPoint.downwind_course_deg) ?? undefined,
  };
}

function normalizeFinalFix(value: unknown): FinalFix | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const rawFix = value as Record<string, unknown>;
  const identifier = asTrimmedString(rawFix.identifier);

  if (!identifier) {
    return undefined;
  }

  return {
    identifier,
    latitude: asFiniteNumber(rawFix.lat) ?? undefined,
    longitude: asFiniteNumber(rawFix.lon) ?? undefined,
    distanceNm: asFiniteNumber(rawFix.distance_nm) ?? undefined,
    alongTrackNm: asFiniteNumber(rawFix.along_track_nm) ?? undefined,
    crossTrackNm: asFiniteNumber(rawFix.cross_track_nm) ?? undefined,
    targetDistanceNm: asFiniteNumber(rawFix.target_distance_nm) ?? undefined,
    crossTrackToleranceNm: asFiniteNumber(rawFix.cross_track_tolerance_nm) ?? undefined,
  };
}

type CasProfileColumnIndexes = {
  time: number;
  casKts: number;
};

const DEFAULT_CAS_PROFILE_COLUMN_INDEXES: CasProfileColumnIndexes = {
  time: 0,
  casKts: 1,
};

function buildCasProfileColumnIndexes(columns: unknown): CasProfileColumnIndexes {
  if (!Array.isArray(columns)) {
    return DEFAULT_CAS_PROFILE_COLUMN_INDEXES;
  }

  const normalizedColumns = columns.map((column) => String(column).trim().toLowerCase());
  const findIndex = (...names: string[]) => {
    const index = normalizedColumns.findIndex((column) => names.includes(column));
    return index >= 0 ? index : null;
  };

  return {
    time: findIndex("time", "timestamp") ?? DEFAULT_CAS_PROFILE_COLUMN_INDEXES.time,
    casKts: findIndex("cas_kts", "cas", "calibrated_airspeed_kts") ?? DEFAULT_CAS_PROFILE_COLUMN_INDEXES.casKts,
  };
}

function normalizeCasProfilePoint(
  rawPoint: unknown,
  columnIndexes: CasProfileColumnIndexes,
): CasProfilePoint | null {
  if (!Array.isArray(rawPoint) || rawPoint.length < 2) {
    return null;
  }

  const time = asFiniteNumber(rawPoint[columnIndexes.time]);
  const casKts = asFiniteNumber(rawPoint[columnIndexes.casKts]);

  if (time === null || casKts === null) {
    return null;
  }

  return {
    time,
    casKts,
  };
}

function normalizeCasProfile(value: unknown): CasProfilePoint[] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const rawCasProfile = value as Record<string, unknown>;
  if (!Array.isArray(rawCasProfile.points)) {
    return undefined;
  }

  const columnIndexes = buildCasProfileColumnIndexes(rawCasProfile.columns);
  const casProfile = rawCasProfile.points
    .map((point) => normalizeCasProfilePoint(point, columnIndexes))
    .filter((point): point is CasProfilePoint => point !== null)
    .sort((left, right) => left.time - right.time);

  return casProfile.length ? casProfile : undefined;
}

type ColumnIndexes = {
  time: number;
  latitude: number;
  longitude: number;
  geoAltitudeMeters: number;
  breakpointMask: number;
};

const DEFAULT_COLUMN_INDEXES: ColumnIndexes = {
  time: 0,
  latitude: 1,
  longitude: 2,
  geoAltitudeMeters: 3,
  breakpointMask: 4,
};

function buildColumnIndexes(columns: unknown): ColumnIndexes {
  if (!Array.isArray(columns)) {
    return DEFAULT_COLUMN_INDEXES;
  }

  const normalizedColumns = columns.map((column) => String(column).trim().toLowerCase());
  const findIndex = (...names: string[]) => {
    const index = normalizedColumns.findIndex((column) => names.includes(column));
    return index >= 0 ? index : null;
  };

  return {
    time: findIndex("time", "timestamp") ?? DEFAULT_COLUMN_INDEXES.time,
    latitude: findIndex("lat", "latitude") ?? DEFAULT_COLUMN_INDEXES.latitude,
    longitude: findIndex("lon", "lng", "longitude") ?? DEFAULT_COLUMN_INDEXES.longitude,
    geoAltitudeMeters:
      findIndex("geoaltitude_m", "geoaltitude", "altitude_m", "altitude") ??
      DEFAULT_COLUMN_INDEXES.geoAltitudeMeters,
    breakpointMask: findIndex("breakpoint_mask") ?? DEFAULT_COLUMN_INDEXES.breakpointMask,
  };
}

function normalizeFlightPoint(rawPoint: unknown, columnIndexes: ColumnIndexes): FlightPoint | null {
  if (!Array.isArray(rawPoint) || rawPoint.length < 4) {
    return null;
  }

  const time = asFiniteNumber(rawPoint[columnIndexes.time]);
  const latitude = asFiniteNumber(rawPoint[columnIndexes.latitude]);
  const longitude = asFiniteNumber(rawPoint[columnIndexes.longitude]);
  const geoAltitudeMeters = asFiniteNumber(rawPoint[columnIndexes.geoAltitudeMeters]);
  const breakpointMask = asFiniteNumber(rawPoint[columnIndexes.breakpointMask]) ?? 0;

  if (time === null || latitude === null || longitude === null || geoAltitudeMeters === null) {
    return null;
  }

  return {
    time,
    latitude,
    longitude,
    geoAltitudeMeters,
    breakpointMask,
  };
}

function normalizeFlight(rawFlight: RawFlight): ReplayFlight | null {
  if (!Array.isArray(rawFlight.points)) {
    return null;
  }

  const columnIndexes = buildColumnIndexes(rawFlight.columns);
  const points = rawFlight.points
    .map((point) => normalizeFlightPoint(point, columnIndexes))
    .filter((point): point is FlightPoint => point !== null)
    .sort((left, right) => left.time - right.time);

  if (points.length === 0) {
    return null;
  }

  const firstTime =
    asFiniteNumber(rawFlight.first_time) ??
    asFiniteNumber(rawFlight.departure_time) ??
    asFiniteNumber(rawFlight.time_at_first_fix) ??
    points[0].time;
  const lastTime =
    asFiniteNumber(rawFlight.last_time) ??
    asFiniteNumber(rawFlight.time_at_last_event) ??
    points[points.length - 1].time;
  const departureTime = asFiniteNumber(rawFlight.departure_time) ?? undefined;
  const arrivalTime = asFiniteNumber(rawFlight.time_at_first_fix) ?? undefined;
  const lastEventTime = asFiniteNumber(rawFlight.time_at_last_event) ?? undefined;
  const baseRoute = normalizeBaseRoute(rawFlight.base_route);
  const fixSequence =
    normalizeFixSequence(rawFlight.fix_sequence) ??
    normalizeFixSequence(baseRoute?.fix_sequence) ??
    normalizeFixSequence(baseRoute?.lateral_path) ??
    normalizeFixSequence(rawFlight.original_fix_sequence);
  const fixCount =
    asFiniteNumber(rawFlight.fix_count) ??
    asFiniteNumber(baseRoute?.fix_count) ??
    asFiniteNumber(rawFlight.original_fix_count) ??
    fixSequence?.length;
  const waitAtcPoint = normalizeWaitAtcPoint(rawFlight.atc_wait_point) ?? normalizeWaitAtcPoint(rawFlight.wait_atc_point);
  const finalFix = normalizeFinalFix(rawFlight.final_fix) ?? normalizeFinalFix(rawFlight.baseline_final_fix);
  const casProfile = normalizeCasProfile(rawFlight.cas_profile);

  return {
    id: String(rawFlight.flight_id || rawFlight.icao24 || rawFlight.callsign || crypto.randomUUID()),
    callsign: String(rawFlight.callsign || "UNKNOWN").trim() || "UNKNOWN",
    icao24: String(rawFlight.icao24 || "").trim(),
    points,
    firstTime,
    lastTime,
    operation: departureTime !== undefined ? "departure" : arrivalTime !== undefined ? "arrival" : undefined,
    runway: asTrimmedString(rawFlight.runway),
    departureTime,
    departureTimeUtc: asTrimmedString(rawFlight.departure_time_utc),
    arrivalTime,
    arrivalTimeUtc: asTrimmedString(rawFlight.time_at_first_fix_utc),
    lastEventTime,
    lastEventTimeUtc: asTrimmedString(rawFlight.time_at_last_event_utc),
    fixSequence,
    fixCount,
    originalFixSequence: normalizeFixSequence(rawFlight.original_fix_sequence),
    originalFixCount: asFiniteNumber(rawFlight.original_fix_count) ?? undefined,
    waitAtcPoint,
    finalFix,
    casProfile,
  };
}

export function parseFlightsJsonl(jsonlText: string): ReplayFlight[] {
  const flights: ReplayFlight[] = [];

  for (const line of jsonlText.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    try {
      const flight = normalizeFlight(JSON.parse(trimmedLine) as RawFlight);
      if (flight) {
        flights.push(flight);
      }
    } catch {
      // Skip malformed rows and keep the replay usable with partial data.
    }
  }

  return flights.sort((left, right) => left.firstTime - right.firstTime || left.callsign.localeCompare(right.callsign));
}

export function parseFlightsJsonArray(jsonPayload: unknown): ReplayFlight[] {
  if (!Array.isArray(jsonPayload)) {
    return [];
  }

  return jsonPayload
    .map((rawFlight) => normalizeFlight(rawFlight as RawFlight))
    .filter((flight): flight is ReplayFlight => flight !== null)
    .sort((left, right) => left.firstTime - right.firstTime || left.callsign.localeCompare(right.callsign));
}

export function getTimeOfDaySeconds(epochSeconds: number): number {
  return ((Math.floor(epochSeconds) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
}

export function buildReplayMetadata(flights: ReplayFlight[]): ReplayMetadata | null {
  if (flights.length === 0) {
    return null;
  }

  const minTime = Math.min(...flights.map((flight) => flight.firstTime));
  const maxTime = Math.max(...flights.map((flight) => flight.lastTime));
  const dayStartTime = Math.floor(minTime / SECONDS_PER_DAY) * SECONDS_PER_DAY;

  return {
    minTime,
    maxTime,
    minTimeOfDay: getTimeOfDaySeconds(minTime),
    maxTimeOfDay: getTimeOfDaySeconds(maxTime),
    dayStartTime,
    flightCount: flights.length,
  };
}
