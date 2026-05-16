import type { ReplayFlight } from "./types";

export type FlightOperation = "departure" | "arrival";
export type FlightOperationValue = FlightOperation | null;

type FlightOperationCatalogDetails = {
  operation: FlightOperation;
  runway?: string;
  eventTime?: number;
  eventTimeUtc?: string;
};

export type FlightOperationCatalog = {
  byFlightId: Map<string, FlightOperationValue>;
  byCallsignIcao24: Map<string, FlightOperationValue>;
  byCallsign: Map<string, FlightOperationValue>;
  detailsByFlightId: Map<string, FlightOperationCatalogDetails | null>;
  detailsByCallsignIcao24: Map<string, FlightOperationCatalogDetails | null>;
  detailsByCallsign: Map<string, FlightOperationCatalogDetails | null>;
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

function normalizeString(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function normalizeFiniteNumber(value: unknown): number | undefined {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
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

function setCatalogDetails(
  catalogMap: Map<string, FlightOperationCatalogDetails | null>,
  key: string | null,
  details: FlightOperationCatalogDetails,
) {
  if (!key) {
    return;
  }

  const previousDetails = catalogMap.get(key);
  if (previousDetails === null) {
    return;
  }
  if (previousDetails === undefined) {
    catalogMap.set(key, details);
    return;
  }

  const sameDetails =
    previousDetails.operation === details.operation &&
    previousDetails.runway === details.runway &&
    previousDetails.eventTime === details.eventTime &&
    previousDetails.eventTimeUtc === details.eventTimeUtc;
  catalogMap.set(key, sameDetails ? previousDetails : null);
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
  const detailsByFlightId = new Map<string, FlightOperationCatalogDetails | null>();
  const detailsByCallsignIcao24 = new Map<string, FlightOperationCatalogDetails | null>();
  const detailsByCallsign = new Map<string, FlightOperationCatalogDetails | null>();
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  const header = lines[0] ? parseCsvLine(lines[0]).map((column) => column.trim().toLowerCase()) : [];
  const columnIndex = (name: string) => header.indexOf(name);
  const flightIdIndex = columnIndex("flight_id");
  const callsignIndex = columnIndex("callsign");
  const icao24Index = columnIndex("icao24");
  const operationIndex = columnIndex("operation");
  const runwayIndex = columnIndex("runway");
  const eventTimeIndex = columnIndex("event_time");
  const eventTimeUtcIndex = columnIndex("event_time_utc");

  if (operationIndex < 0) {
    return {
      byFlightId,
      byCallsignIcao24,
      byCallsign,
      detailsByFlightId,
      detailsByCallsignIcao24,
      detailsByCallsign,
    };
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

    const details = {
      operation,
      runway: normalizeString(columns[runwayIndex]),
      eventTime: normalizeFiniteNumber(columns[eventTimeIndex]),
      eventTimeUtc: normalizeString(columns[eventTimeUtcIndex]),
    };
    setCatalogDetails(detailsByFlightId, normalizeFlightId(columns[flightIdIndex]), details);
    setCatalogDetails(
      detailsByCallsignIcao24,
      callsignIcao24Key(columns[callsignIndex], columns[icao24Index]),
      details,
    );
    setCatalogDetails(detailsByCallsign, normalizeCallsign(columns[callsignIndex]), details);
  }

  return {
    byFlightId,
    byCallsignIcao24,
    byCallsign,
    detailsByFlightId,
    detailsByCallsignIcao24,
    detailsByCallsign,
  };
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

function getFlightOperationCatalogDetails(
  flight: Pick<ReplayFlight, "id" | "callsign" | "icao24">,
  catalog: FlightOperationCatalog,
): FlightOperationCatalogDetails | null {
  return (
    catalog.detailsByFlightId.get(normalizeFlightId(flight.id) ?? "") ??
    catalog.detailsByCallsignIcao24.get(callsignIcao24Key(flight.callsign, flight.icao24) ?? "") ??
    catalog.detailsByCallsign.get(normalizeCallsign(flight.callsign) ?? "") ??
    null
  );
}

export function applyFlightOperationCatalog(
  flights: ReplayFlight[],
  catalog: FlightOperationCatalog,
): ReplayFlight[] {
  return flights.map((flight) => {
    const operation = classifyFlightOperation(flight, catalog);
    const details = getFlightOperationCatalogDetails(flight, catalog);
    if (!operation && !details) {
      return flight;
    }

    const nextFlight: ReplayFlight = operation && flight.operation !== operation ? { ...flight, operation } : flight;
    const effectiveOperation = operation ?? nextFlight.operation;
    if (!details || details.operation !== effectiveOperation) {
      return nextFlight;
    }

    if (effectiveOperation === "departure") {
      return {
        ...nextFlight,
        runway: nextFlight.runway ?? details.runway,
        departureTime: nextFlight.departureTime ?? details.eventTime,
        departureTimeUtc: nextFlight.departureTimeUtc ?? details.eventTimeUtc,
      };
    }

    return {
      ...nextFlight,
      runway: nextFlight.runway ?? details.runway,
      arrivalTime: nextFlight.arrivalTime ?? details.eventTime,
      arrivalTimeUtc: nextFlight.arrivalTimeUtc ?? details.eventTimeUtc,
      lastEventTime: nextFlight.lastEventTime ?? details.eventTime,
      lastEventTimeUtc: nextFlight.lastEventTimeUtc ?? details.eventTimeUtc,
    };
  });
}
