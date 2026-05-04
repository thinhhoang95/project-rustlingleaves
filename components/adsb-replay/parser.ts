import type { FlightPoint, ReplayFlight, ReplayMetadata } from "./types";

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
  original_fix_sequence?: unknown;
  original_fix_count?: unknown;
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
  const fixSequence = asTrimmedString(value);
  if (!fixSequence) {
    return undefined;
  }

  return fixSequence
    .split(">")
    .map((fixName) => fixName.trim())
    .filter(Boolean);
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
  const originalFixCount = asFiniteNumber(rawFlight.original_fix_count) ?? undefined;

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
    originalFixSequence: normalizeFixSequence(rawFlight.original_fix_sequence),
    originalFixCount,
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
