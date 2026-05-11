"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { interpolateFlightAtTime } from "@/components/adsb-replay/interpolate";
import type { ReplayFlight } from "@/components/adsb-replay/types";

type SimulationFlightDetailsPanelProps = {
  flight: ReplayFlight;
  currentSimulationTime: number;
  onClose: () => void;
  onSelectFix: (fixName: string) => void;
};

type VerticalProfilePoint = {
  time: number;
  altitudeFt: number;
  utcTime: string;
  elapsedLabel: string;
};

const METERS_TO_FEET = 3.280839895;

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

function formatUtcClockTime(epochSeconds: number | undefined, utcTime: string | undefined): string {
  if (utcTime) {
    const time = utcTime.match(/T(\d{2}:\d{2}(?::\d{2})?)/)?.[1];
    return time ? `${time} UTC` : formatUtcTime(epochSeconds, utcTime);
  }

  if (epochSeconds === undefined) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
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

function normalizeFixIdentifier(identifier: string | undefined): string | undefined {
  return identifier?.trim().toUpperCase() || undefined;
}

function buildFixChipLabel(fixName: string, isWaitAtcFix: boolean, isFinalFix: boolean): string {
  const roles = [
    isWaitAtcFix ? "ATC wait point" : undefined,
    isFinalFix ? "final fix" : undefined,
  ].filter(Boolean);

  return roles.length ? `Pan map to ${fixName}, ${roles.join(" and ")}` : `Pan map to ${fixName}`;
}

function formatElapsedTime(time: number, startTime: number): string {
  const totalSeconds = Math.max(0, Math.round(time - startTime));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatAltitude(altitudeFt: number): string {
  return `${altitudeFt.toLocaleString("en-US")} ft`;
}

function VerticalProfileTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload as VerticalProfilePoint | undefined;
  if (!point) {
    return null;
  }

  return (
    <div className="flight-profile-tooltip">
      <span>{point.utcTime}</span>
      <strong>{formatAltitude(point.altitudeFt)}</strong>
      <small>T+{point.elapsedLabel}</small>
    </div>
  );
}

export default function SimulationFlightDetailsPanel({
  flight,
  currentSimulationTime,
  onClose,
  onSelectFix,
}: SimulationFlightDetailsPanelProps) {
  const isArrival = flight.operation === "arrival";
  const eventLabel = isArrival ? "Arrival time" : "Departure time";
  const eventTime = isArrival
    ? formatUtcClockTime(flight.arrivalTime, flight.arrivalTimeUtc)
    : formatUtcClockTime(flight.departureTime, flight.departureTimeUtc);
  const waitAtcRouteIndex =
    flight.waitAtcPoint?.source === "fix" && Number.isInteger(flight.waitAtcPoint.routeIndex)
      ? flight.waitAtcPoint.routeIndex
      : undefined;
  const waitAtcFixIdentifier =
    flight.waitAtcPoint?.source === "fix" ? normalizeFixIdentifier(flight.waitAtcPoint.identifier) : undefined;
  const finalFixIdentifier = normalizeFixIdentifier(flight.finalFix?.identifier);
  const fixSequence = flight.fixSequence ?? flight.originalFixSequence;
  const fixCount = flight.fixCount ?? flight.originalFixCount ?? fixSequence?.length;
  const verticalProfileData = useMemo<VerticalProfilePoint[]>(
    () =>
      flight.points.map((point) => ({
        time: point.time,
        altitudeFt: Math.round(point.geoAltitudeMeters * METERS_TO_FEET),
        utcTime: formatUtcTime(point.time, undefined),
        elapsedLabel: formatElapsedTime(point.time, flight.firstTime),
      })),
    [flight.firstTime, flight.points],
  );
  const currentProfilePoint = useMemo<VerticalProfilePoint | null>(() => {
    const aircraftState = interpolateFlightAtTime(flight, currentSimulationTime);

    if (!aircraftState) {
      return null;
    }

    return {
      time: currentSimulationTime,
      altitudeFt: Math.round(aircraftState.geoAltitudeMeters * METERS_TO_FEET),
      utcTime: formatUtcTime(currentSimulationTime, undefined),
      elapsedLabel: formatElapsedTime(currentSimulationTime, flight.firstTime),
    };
  }, [currentSimulationTime, flight]);

  return (
    <section className="side-panel flight-details-panel" aria-label="Selected simulation flight">
      <div className="side-panel-header">
        <div>
          <span className="side-panel-kicker">{isArrival ? "Arrival" : "Departure"}</span>
          <h2>{flight.callsign || flight.id}</h2>
        </div>
        <div className="side-panel-actions">
          <button
            type="button"
            className="side-panel-close"
            aria-label="Close selected flight panel"
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
        <DetailRow label={eventLabel} value={eventTime} />
        {isArrival ? (
          <DetailRow label="Last event" value={formatUtcClockTime(flight.lastEventTime, flight.lastEventTimeUtc)} />
        ) : null}
        <DetailRow label="Runway" value={flight.runway} />
      </div>

      {verticalProfileData.length ? (
        <div className="flight-profile-section">
          <div className="flight-profile-header">
            <span>Vertical profile</span>
            {currentProfilePoint ? <strong>{formatAltitude(currentProfilePoint.altitudeFt)}</strong> : null}
          </div>
          <div className="flight-profile-chart" aria-label="Altitude over time">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 270, height: 164 }}>
              <ComposedChart data={verticalProfileData} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(time) => formatElapsedTime(Number(time), flight.firstTime)}
                  stroke="rgba(159, 177, 195, 0.72)"
                  tick={{ fill: "rgba(159, 177, 195, 0.82)", fontSize: 10, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(148, 163, 184, 0.18)" }}
                  minTickGap={20}
                />
                <YAxis
                  dataKey="altitudeFt"
                  width={46}
                  tickFormatter={(altitudeFt) => `${Math.round(Number(altitudeFt) / 1000)}k`}
                  stroke="rgba(159, 177, 195, 0.72)"
                  tick={{ fill: "rgba(159, 177, 195, 0.82)", fontSize: 10, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(148, 163, 184, 0.18)" }}
                />
                <Tooltip
                  content={(tooltipProps) => <VerticalProfileTooltip {...tooltipProps} />}
                  cursor={{ stroke: "rgba(94, 234, 212, 0.3)" }}
                />
                <Line
                  type="monotone"
                  dataKey="altitudeFt"
                  name="Altitude"
                  stroke="rgba(94, 234, 212, 0.96)"
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#f8fdff" }}
                  isAnimationActive={false}
                />
                {currentProfilePoint ? (
                  <>
                    <ReferenceLine
                      x={currentProfilePoint.time}
                      stroke="rgba(245, 158, 11, 0.58)"
                      strokeDasharray="3 3"
                    />
                    <Scatter
                      data={[currentProfilePoint]}
                      dataKey="altitudeFt"
                      fill="#f59e0b"
                      isAnimationActive={false}
                    />
                  </>
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {isArrival && fixSequence?.length ? (
        <div className="flight-fix-section">
          <div className="flight-fix-header">
            <span>Fix sequence</span>
            <strong>{fixCount}</strong>
          </div>
          <div className="flight-fix-list" aria-label="Fix sequence">
            {fixSequence.map((fixName, index) => {
              const normalizedFixName = normalizeFixIdentifier(fixName);
              const isWaitAtcFix =
                normalizedFixName === waitAtcFixIdentifier ||
                (waitAtcRouteIndex !== undefined && index === waitAtcRouteIndex);
              const isFinalFix = normalizedFixName === finalFixIdentifier;
              const chipClassName = [
                "flight-fix-chip",
                isWaitAtcFix ? "flight-fix-chip-atc" : undefined,
                isFinalFix ? "flight-fix-chip-final" : undefined,
              ]
                .filter(Boolean)
                .join(" ");
              const chipLabel = buildFixChipLabel(fixName, isWaitAtcFix, isFinalFix);

              return (
                <button
                  key={`${fixName}-${index}`}
                  type="button"
                  className={chipClassName}
                  title={chipLabel}
                  aria-label={chipLabel}
                  onClick={() => onSelectFix(fixName)}
                >
                  {fixName}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
