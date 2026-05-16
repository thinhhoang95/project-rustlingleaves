import type { MapCoordinate } from "@/components/map-view-types";
import { getFlightLineColor } from "./flight-line-colors";
import { metersToFlightLevel } from "./interpolate";
import type {
  AircraftFeatureCollection,
  AircraftState,
  FlightLineFeature,
  FlightLineFeatureCollection,
  ReplayFlight,
} from "./types";

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
  selectedFlightId: string | null = null,
): FlightLineFeatureCollection {
  const flightsById = new Map(flights.map((flight) => [flight.id, flight]));
  const features: FlightLineFeature[] = [];

  for (const state of aircraft) {
    if (selectedFlightId && state.flightId !== selectedFlightId) {
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
        lineColor: getFlightLineColor(flight),
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
