"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  Line,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { ReplayFlight } from "@/components/adsb-replay/types";
import {
  buildCurrentVerticalProfilePoint,
  buildVerticalProfileData,
  DetailRow,
  formatElapsedTime,
  formatUtcClockTime,
  formatUtcTime,
  VerticalProfileChart,
} from "@/components/FlightDetailsPanelParts";

type SimulationFlightDetailsPanelProps = {
  flight: ReplayFlight;
  currentSimulationTime: number;
  onClose: () => void;
  onSelectFix: (fixName: string) => void;
};

type CasProfileChartPoint = {
  time: number;
  casKts: number;
  utcTime: string;
  elapsedLabel: string;
};

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

function formatCalibratedAirspeed(casKts: number): string {
  return `${Math.round(casKts).toLocaleString("en-US")} kt`;
}

function interpolateCalibratedAirspeed(
  profile: { time: number; casKts: number }[] | undefined,
  time: number,
): number | null {
  if (!profile?.length || time < profile[0].time || time > profile[profile.length - 1].time) {
    return null;
  }

  if (profile.length === 1) {
    return profile[0].casKts;
  }

  let low = 0;
  let high = profile.length - 2;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (profile[mid].time <= time && time <= profile[mid + 1].time) {
      const fromPoint = profile[mid];
      const toPoint = profile[mid + 1];
      const duration = toPoint.time - fromPoint.time;
      const fraction = duration > 0 ? Math.max(0, Math.min(1, (time - fromPoint.time) / duration)) : 0;
      return fromPoint.casKts + (toPoint.casKts - fromPoint.casKts) * fraction;
    }
    if (profile[mid].time > time) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return null;
}

function CasProfileTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload as CasProfileChartPoint | undefined;
  if (!point) {
    return null;
  }

  return (
    <div className="flight-profile-tooltip">
      <span>{point.utcTime}</span>
      <strong>{formatCalibratedAirspeed(point.casKts)}</strong>
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
  const verticalProfileData = useMemo(() => buildVerticalProfileData(flight), [flight]);
  const currentProfilePoint = useMemo(
    () => buildCurrentVerticalProfilePoint(flight, currentSimulationTime),
    [currentSimulationTime, flight],
  );
  const casProfileData = useMemo<CasProfileChartPoint[]>(
    () =>
      flight.casProfile?.map((point) => ({
        time: point.time,
        casKts: point.casKts,
        utcTime: formatUtcTime(point.time, undefined),
        elapsedLabel: formatElapsedTime(point.time, flight.firstTime),
      })) ?? [],
    [flight.casProfile, flight.firstTime],
  );
  const currentCasProfilePoint = useMemo<CasProfileChartPoint | null>(() => {
    const casKts = interpolateCalibratedAirspeed(flight.casProfile, currentSimulationTime);

    if (casKts === null) {
      return null;
    }

    return {
      time: currentSimulationTime,
      casKts,
      utcTime: formatUtcTime(currentSimulationTime, undefined),
      elapsedLabel: formatElapsedTime(currentSimulationTime, flight.firstTime),
    };
  }, [currentSimulationTime, flight.casProfile, flight.firstTime]);

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

      <VerticalProfileChart
        data={verticalProfileData}
        currentPoint={currentProfilePoint}
        startTime={flight.firstTime}
      />

      {casProfileData.length ? (
        <div className="flight-profile-section">
          <div className="flight-profile-header">
            <span>CAS profile</span>
            {currentCasProfilePoint ? (
              <strong className="flight-profile-value-speed">
                {formatCalibratedAirspeed(currentCasProfilePoint.casKts)}
              </strong>
            ) : null}
          </div>
          <div className="flight-profile-chart" aria-label="Calibrated airspeed over time">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 270, height: 164 }}>
              <ComposedChart data={casProfileData} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
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
                  dataKey="casKts"
                  width={46}
                  tickFormatter={(casKts) => Math.round(Number(casKts)).toString()}
                  stroke="rgba(159, 177, 195, 0.72)"
                  tick={{ fill: "rgba(159, 177, 195, 0.82)", fontSize: 10, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(148, 163, 184, 0.18)" }}
                />
                <Tooltip
                  content={(tooltipProps) => <CasProfileTooltip {...tooltipProps} />}
                  cursor={{ stroke: "rgba(96, 165, 250, 0.3)" }}
                />
                <Line
                  type="monotone"
                  dataKey="casKts"
                  name="CAS"
                  stroke="rgba(96, 165, 250, 0.96)"
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#f8fdff" }}
                  isAnimationActive={false}
                />
                {currentCasProfilePoint ? (
                  <>
                    <ReferenceLine
                      x={currentCasProfilePoint.time}
                      stroke="rgba(245, 158, 11, 0.58)"
                      strokeDasharray="3 3"
                    />
                    <Scatter
                      data={[currentCasProfilePoint]}
                      dataKey="casKts"
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
