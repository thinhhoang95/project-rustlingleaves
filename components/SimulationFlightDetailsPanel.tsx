"use client";

import type { ReplayFlight } from "@/components/adsb-replay/types";

type SimulationFlightDetailsPanelProps = {
  flight: ReplayFlight;
  onClose: () => void;
};

function formatUtcTime(epochSeconds: number | undefined, utcTime: string | undefined): string {
  if (utcTime) {
    return utcTime.replace("T", " ").replace("Z", " UTC");
  }

  if (epochSeconds === undefined) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(epochSeconds * 1000));
}

function DetailRow({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flight-detail-row">
      <span>{label}</span>
      <strong>{value || "Unknown"}</strong>
    </div>
  );
}

export default function SimulationFlightDetailsPanel({ flight, onClose }: SimulationFlightDetailsPanelProps) {
  const isArrival = flight.operation === "arrival";
  const eventLabel = isArrival ? "Arrival time" : "Departure time";
  const eventTime = isArrival
    ? formatUtcTime(flight.arrivalTime, flight.arrivalTimeUtc)
    : formatUtcTime(flight.departureTime, flight.departureTimeUtc);

  return (
    <section className="side-panel flight-details-panel" aria-label="Selected simulation flight">
      <div className="side-panel-header">
        <div>
          <span className="side-panel-kicker">{isArrival ? "Arrival" : "Departure"}</span>
          <h2>{flight.callsign || flight.id}</h2>
        </div>
        <div className="side-panel-actions">
          <span className="flight-operation-pill">{isArrival ? "ARR" : "DEP"}</span>
          <button
            type="button"
            className="side-panel-close"
            aria-label="Close selected flight panel"
            onClick={onClose}
          >
            <span>Close</span>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flight-detail-list">
        <DetailRow label="Callsign" value={flight.callsign} />
        <DetailRow label="ICAO24" value={flight.icao24} />
        <DetailRow label={eventLabel} value={eventTime} />
        {isArrival ? (
          <DetailRow label="Last event" value={formatUtcTime(flight.lastEventTime, flight.lastEventTimeUtc)} />
        ) : null}
        <DetailRow label="Runway" value={flight.runway} />
      </div>

      {isArrival && flight.originalFixSequence?.length ? (
        <div className="flight-fix-section">
          <div className="flight-fix-header">
            <span>Original fixes</span>
            <strong>{flight.originalFixCount ?? flight.originalFixSequence.length}</strong>
          </div>
          <div className="flight-fix-list" aria-label="Original fix sequence">
            {flight.originalFixSequence.map((fixName, index) => (
              <span key={`${fixName}-${index}`} className="flight-fix-chip">
                {fixName}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
