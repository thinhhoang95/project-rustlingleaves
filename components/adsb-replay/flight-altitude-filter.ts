import type { AircraftState } from "./types";
import { metersToFlightLevel } from "./interpolate";

export type FlightAltitudeRange = {
  minFlightLevel: number;
  maxFlightLevel: number;
};

export const MIN_FILTER_FLIGHT_LEVEL = 0;
export const MAX_FILTER_FLIGHT_LEVEL = 400;
export const FLIGHT_ALTITUDE_STEP_FL = 5;

export const DEFAULT_FLIGHT_ALTITUDE_RANGE: FlightAltitudeRange = {
  minFlightLevel: MIN_FILTER_FLIGHT_LEVEL,
  maxFlightLevel: MAX_FILTER_FLIGHT_LEVEL,
};

export function clampFlightLevel(flightLevel: number): number {
  return Math.max(
    MIN_FILTER_FLIGHT_LEVEL,
    Math.min(MAX_FILTER_FLIGHT_LEVEL, Math.round(flightLevel / FLIGHT_ALTITUDE_STEP_FL) * FLIGHT_ALTITUDE_STEP_FL),
  );
}

export function isFlightLevelInAltitudeRange(
  flightLevel: number,
  altitudeRange: FlightAltitudeRange = DEFAULT_FLIGHT_ALTITUDE_RANGE,
): boolean {
  return flightLevel >= altitudeRange.minFlightLevel && flightLevel <= altitudeRange.maxFlightLevel;
}

export function isAircraftInAltitudeRange(
  aircraft: Pick<AircraftState, "geoAltitudeMeters">,
  altitudeRange: FlightAltitudeRange = DEFAULT_FLIGHT_ALTITUDE_RANGE,
): boolean {
  return isFlightLevelInAltitudeRange(metersToFlightLevel(aircraft.geoAltitudeMeters), altitudeRange);
}
