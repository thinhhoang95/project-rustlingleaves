import type { FlightPoint, ReplayFlight, ReplayMetadata } from "./types";

type RawFlight = {
  flight_id?: unknown;
  callsign?: unknown;
  icao24?: unknown;
  points?: unknown;
  first_time?: unknown;
  last_time?: unknown;
};

const SECONDS_PER_DAY = 24 * 60 * 60;

function asFiniteNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeFlightPoint(rawPoint: unknown): FlightPoint | null {
  if (!Array.isArray(rawPoint) || rawPoint.length < 4) {
    return null;
  }

  const time = asFiniteNumber(rawPoint[0]);
  const latitude = asFiniteNumber(rawPoint[1]);
  const longitude = asFiniteNumber(rawPoint[2]);
  const geoAltitudeMeters = asFiniteNumber(rawPoint[3]);
  const breakpointMask = asFiniteNumber(rawPoint[4]) ?? 0;

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

  const points = rawFlight.points
    .map(normalizeFlightPoint)
    .filter((point): point is FlightPoint => point !== null)
    .sort((left, right) => left.time - right.time);

  if (points.length === 0) {
    return null;
  }

  const firstTime = asFiniteNumber(rawFlight.first_time) ?? points[0].time;
  const lastTime = asFiniteNumber(rawFlight.last_time) ?? points[points.length - 1].time;

  return {
    id: String(rawFlight.flight_id || rawFlight.icao24 || rawFlight.callsign || crypto.randomUUID()),
    callsign: String(rawFlight.callsign || "UNKNOWN").trim() || "UNKNOWN",
    icao24: String(rawFlight.icao24 || "").trim(),
    points,
    firstTime,
    lastTime,
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
