import type { MapCoordinate } from "@/components/map-view";
import { metersToFlightLevel } from "./interpolate";
import type {
  AircraftFeatureCollection,
  AircraftState,
  FlightLineFeature,
  FlightLineFeatureCollection,
  ReplayFlight,
} from "./types";

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

function coordinateIsInBounds(coordinate: MapCoordinate, bounds: BoundsLike | null): boolean {
  if (!bounds || !isBoundsObject(bounds)) {
    return true;
  }

  const [longitude, latitude] = coordinate;
  return (
    longitude >= bounds.getWest() &&
    longitude <= bounds.getEast() &&
    latitude >= bounds.getSouth() &&
    latitude <= bounds.getNorth()
  );
}

export function buildAircraftCollection(aircraft: AircraftState[]): AircraftFeatureCollection {
  return {
    type: "FeatureCollection",
    features: aircraft.map((state) => {
      const flightLevel = metersToFlightLevel(state.geoAltitudeMeters);
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: state.coordinate,
        },
        properties: {
          flightId: state.flightId,
          callsign: state.callsign,
          icao24: state.icao24,
          altitudeFt: Math.round(state.geoAltitudeMeters * 3.280839895),
          altitudeLabel: `FL${flightLevel.toString().padStart(3, "0")}`,
          trackDegrees: state.trackDegrees,
        },
      };
    }),
  };
}

export function buildVisibleFlightLineCollection(
  flights: ReplayFlight[],
  aircraft: AircraftState[],
  bounds: BoundsLike | null,
): FlightLineFeatureCollection {
  const flightsById = new Map(flights.map((flight) => [flight.id, flight]));
  const features: FlightLineFeature[] = [];

  for (const state of aircraft) {
    if (!coordinateIsInBounds(state.coordinate, bounds)) {
      continue;
    }

    const flight = flightsById.get(state.flightId);
    if (!flight) {
      continue;
    }

    const coordinates: MapCoordinate[] = flight.points
      .filter((point) => point.time <= state.time)
      .map((point) => [point.longitude, point.latitude]);
    coordinates.push(state.coordinate);

    if (coordinates.length < 2) {
      continue;
    }

    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates,
      },
      properties: {
        flightId: state.flightId,
        callsign: state.callsign,
        icao24: state.icao24,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
