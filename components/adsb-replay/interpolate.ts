import type { AircraftState, FlightPoint, ReplayFlight, ReplaySnapshot } from "./types";

const METERS_TO_FEET = 3.280839895;

function interpolateNumber(start: number, end: number, fraction: number): number {
  return start + (end - start) * fraction;
}

function calculateTrackDegrees(fromPoint: FlightPoint, toPoint: FlightPoint): number {
  const fromLatitude = (fromPoint.latitude * Math.PI) / 180;
  const toLatitude = (toPoint.latitude * Math.PI) / 180;
  const deltaLongitude = ((toPoint.longitude - fromPoint.longitude) * Math.PI) / 180;
  const y = Math.sin(deltaLongitude) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(deltaLongitude);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function findSegmentIndex(points: FlightPoint[], time: number): number {
  let low = 0;
  let high = points.length - 2;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].time <= time && time <= points[mid + 1].time) {
      return mid;
    }
    if (points[mid].time > time) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return Math.max(0, Math.min(points.length - 2, low));
}

export function interpolateFlightAtTime(flight: ReplayFlight, time: number): AircraftState | null {
  if (time < flight.firstTime || time > flight.lastTime || flight.points.length === 0) {
    return null;
  }

  if (flight.points.length === 1) {
    const point = flight.points[0];
    return {
      flightId: flight.id,
      callsign: flight.callsign,
      icao24: flight.icao24,
      time,
      latitude: point.latitude,
      longitude: point.longitude,
      geoAltitudeMeters: point.geoAltitudeMeters,
      trackDegrees: 0,
      coordinate: [point.longitude, point.latitude],
    };
  }

  const segmentIndex = findSegmentIndex(flight.points, time);
  const fromPoint = flight.points[segmentIndex];
  const toPoint = flight.points[segmentIndex + 1];
  const duration = toPoint.time - fromPoint.time;
  const fraction = duration > 0 ? Math.max(0, Math.min(1, (time - fromPoint.time) / duration)) : 0;
  const latitude = interpolateNumber(fromPoint.latitude, toPoint.latitude, fraction);
  const longitude = interpolateNumber(fromPoint.longitude, toPoint.longitude, fraction);

  return {
    flightId: flight.id,
    callsign: flight.callsign,
    icao24: flight.icao24,
    time,
    latitude,
    longitude,
    geoAltitudeMeters: interpolateNumber(fromPoint.geoAltitudeMeters, toPoint.geoAltitudeMeters, fraction),
    trackDegrees: calculateTrackDegrees(fromPoint, toPoint),
    coordinate: [longitude, latitude],
  };
}

export function buildReplaySnapshot(flights: ReplayFlight[], time: number): ReplaySnapshot {
  return {
    time,
    aircraft: flights
      .map((flight) => interpolateFlightAtTime(flight, time))
      .filter((aircraft): aircraft is AircraftState => aircraft !== null),
  };
}

export function metersToFlightLevel(geoAltitudeMeters: number): number {
  return Math.max(0, Math.round((geoAltitudeMeters * METERS_TO_FEET) / 100));
}
