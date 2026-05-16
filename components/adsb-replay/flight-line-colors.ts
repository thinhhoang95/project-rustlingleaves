import {
  classifyFlightOperation,
  type FlightOperation,
  type FlightOperationCatalog,
  type FlightOperationValue,
} from "./flight-operation-catalog";
import type { ReplayFlight } from "./types";

export type { FlightOperation, FlightOperationCatalog } from "./flight-operation-catalog";

export type FlightOperationGroup = FlightOperation | "unknown";
export type FlightOperationVisibility = Record<FlightOperationGroup, boolean>;

export const FLIGHT_LINE_COLORS = {
  departure: "#86efac",
  arrival: "#38bdf8",
  unknown: "#fde047",
} as const;

export const DEFAULT_FLIGHT_OPERATION_VISIBILITY: FlightOperationVisibility = {
  departure: true,
  arrival: true,
  unknown: true,
};

export function getFlightLineColorForOperation(operation: FlightOperationValue): string {
  return operation ? FLIGHT_LINE_COLORS[operation] : FLIGHT_LINE_COLORS.unknown;
}

export function getFlightOperationGroup(
  flight: Pick<ReplayFlight, "id" | "callsign" | "icao24" | "operation">,
  catalog?: FlightOperationCatalog | null,
): FlightOperationGroup {
  return classifyFlightOperation(flight, catalog) ?? "unknown";
}

export function isFlightOperationGroupVisible(
  operationGroup: FlightOperationGroup,
  visibility: FlightOperationVisibility = DEFAULT_FLIGHT_OPERATION_VISIBILITY,
): boolean {
  return visibility[operationGroup];
}

export function isFlightVisibleByOperation(
  flight: Pick<ReplayFlight, "id" | "callsign" | "icao24" | "operation">,
  visibility: FlightOperationVisibility = DEFAULT_FLIGHT_OPERATION_VISIBILITY,
  catalog?: FlightOperationCatalog | null,
): boolean {
  return isFlightOperationGroupVisible(getFlightOperationGroup(flight, catalog), visibility);
}

export function getFlightLineColor(
  flight: Pick<ReplayFlight, "id" | "callsign" | "icao24" | "operation">,
  catalog?: FlightOperationCatalog | null,
): string {
  return getFlightLineColorForOperation(classifyFlightOperation(flight, catalog));
}
