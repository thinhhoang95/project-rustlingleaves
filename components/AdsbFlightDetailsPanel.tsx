"use client";

import { useMemo } from "react";
import type { ReplayFlight } from "@/components/adsb-replay/types";
import {
  buildCurrentVerticalProfilePoint,
  buildVerticalProfileData,
  DetailRow,
  formatUtcClockTime,
  VerticalProfileChart,
} from "@/components/FlightDetailsPanelParts";

type AdsbFlightDetailsPanelProps = {
  flight: ReplayFlight;
  currentReplayTime: number;
  onClose: () => void;
};

function formatDuration(startTime: number, endTime: number): string {
  const totalSeconds = Math.max(0, Math.round(endTime - startTime));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function AdsbFlightDetailsPanel({
  flight,
  currentReplayTime,
  onClose,
}: AdsbFlightDetailsPanelProps) {
  const verticalProfileData = useMemo(() => buildVerticalProfileData(flight), [flight]);
  const currentProfilePoint = useMemo(
    () => buildCurrentVerticalProfilePoint(flight, currentReplayTime),
    [currentReplayTime, flight],
  );

  return (
    <section className="side-panel flight-details-panel" aria-label="Selected ADS-B flight">
      <div className="side-panel-header">
        <div>
          <span className="side-panel-kicker">ADS-B track</span>
          <h2>{flight.callsign || flight.id}</h2>
        </div>
        <div className="side-panel-actions">
          <button
            type="button"
            className="side-panel-close"
            aria-label="Close selected ADS-B flight panel"
            onClick={onClose}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flight-detail-list">
        <DetailRow label="Callsign" value={flight.callsign} />
        <DetailRow label="ICAO24" value={flight.icao24} />
        <DetailRow label="First observed" value={formatUtcClockTime(flight.firstTime, undefined)} />
        <DetailRow label="Last observed" value={formatUtcClockTime(flight.lastTime, undefined)} />
        <DetailRow label="Duration" value={formatDuration(flight.firstTime, flight.lastTime)} />
        <DetailRow label="Point count" value={flight.points.length.toLocaleString("en-US")} />
      </div>

      <VerticalProfileChart
        data={verticalProfileData}
        currentPoint={currentProfilePoint}
        startTime={flight.firstTime}
      />
    </section>
  );
}
