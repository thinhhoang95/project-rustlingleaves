import type { ReplayFlight } from "./types";

export type FlightOperation = "departure" | "arrival";
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

type FlightOperationValue = FlightOperation | null;

export type FlightOperationCatalog = {
  byFlightId: Map<string, FlightOperationValue>;
  byCallsignIcao24: Map<string, FlightOperationValue>;
  byCallsign: Map<string, FlightOperationValue>;
};

function normalizeFlightId(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

function normalizeCallsign(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function normalizeIcao24(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

function normalizeOperation(value: unknown): FlightOperationValue {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "departure" || normalized === "arrival") {
    return normalized;
  }

  return null;
}

function callsignIcao24Key(callsign: unknown, icao24: unknown): string | null {
  const normalizedCallsign = normalizeCallsign(callsign);
  const normalizedIcao24 = normalizeIcao24(icao24);

  if (!normalizedCallsign || !normalizedIcao24) {
    return null;
  }

  return `${normalizedCallsign}|${normalizedIcao24}`;
}

function setCatalogOperation(
  catalogMap: Map<string, FlightOperationValue>,
  key: string | null,
  operation: FlightOperation,
) {
  if (!key) {
    return;
  }

  const previousOperation = catalogMap.get(key);
  catalogMap.set(key, previousOperation === undefined || previousOperation === operation ? operation : null);
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      values.push(value);
      value = "";
      continue;
    }

    value += character;
  }

  values.push(value);
  return values;
}

export function parseFlightOperationCatalog(csvText: string): FlightOperationCatalog {
  const byFlightId = new Map<string, FlightOperationValue>();
  const byCallsignIcao24 = new Map<string, FlightOperationValue>();
  const byCallsign = new Map<string, FlightOperationValue>();
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  const header = lines[0] ? parseCsvLine(lines[0]).map((column) => column.trim().toLowerCase()) : [];
  const columnIndex = (name: string) => header.indexOf(name);
  const flightIdIndex = columnIndex("flight_id");
  const callsignIndex = columnIndex("callsign");
  const icao24Index = columnIndex("icao24");
  const operationIndex = columnIndex("operation");

  if (operationIndex < 0) {
    return { byFlightId, byCallsignIcao24, byCallsign };
  }

  for (const line of lines.slice(1)) {
    const columns = parseCsvLine(line);
    const operation = normalizeOperation(columns[operationIndex]);
    if (!operation) {
      continue;
    }

    setCatalogOperation(byFlightId, normalizeFlightId(columns[flightIdIndex]), operation);
    setCatalogOperation(byCallsignIcao24, callsignIcao24Key(columns[callsignIndex], columns[icao24Index]), operation);
    setCatalogOperation(byCallsign, normalizeCallsign(columns[callsignIndex]), operation);
  }

  return { byFlightId, byCallsignIcao24, byCallsign };
}

export function classifyFlightOperation(
  flight: Pick<ReplayFlight, "id" | "callsign" | "icao24" | "operation">,
  catalog?: FlightOperationCatalog | null,
): FlightOperationValue {
  if (flight.operation === "departure" || flight.operation === "arrival") {
    return flight.operation;
  }

  if (!catalog) {
    return null;
  }

  return (
    catalog.byFlightId.get(normalizeFlightId(flight.id) ?? "") ??
    catalog.byCallsignIcao24.get(callsignIcao24Key(flight.callsign, flight.icao24) ?? "") ??
    catalog.byCallsign.get(normalizeCallsign(flight.callsign) ?? "") ??
    null
  );
}

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

export function applyFlightOperationCatalog(
  flights: ReplayFlight[],
  catalog: FlightOperationCatalog,
): ReplayFlight[] {
  return flights.map((flight) => {
    const operation = classifyFlightOperation(flight, catalog);
    return operation && flight.operation !== operation ? { ...flight, operation } : flight;
  });
}
