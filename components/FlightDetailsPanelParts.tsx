"use client";

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

export type VerticalProfilePoint = {
  time: number;
  altitudeFt: number;
  utcTime: string;
  elapsedLabel: string;
};

const METERS_TO_FEET = 3.280839895;

export function formatUtcTime(epochSeconds: number | undefined, utcTime: string | undefined): string {
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

export function formatUtcClockTime(epochSeconds: number | undefined, utcTime: string | undefined): string {
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

export function formatElapsedTime(time: number, startTime: number): string {
  const totalSeconds = Math.max(0, Math.round(time - startTime));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatAltitude(altitudeFt: number): string {
  return `${altitudeFt.toLocaleString("en-US")} ft`;
}

export function DetailRow({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flight-detail-row">
      <span>{label}</span>
      <strong>{value || "Unknown"}</strong>
    </div>
  );
}

export function buildVerticalProfileData(flight: ReplayFlight): VerticalProfilePoint[] {
  return flight.points.map((point) => ({
    time: point.time,
    altitudeFt: Math.round(point.geoAltitudeMeters * METERS_TO_FEET),
    utcTime: formatUtcTime(point.time, undefined),
    elapsedLabel: formatElapsedTime(point.time, flight.firstTime),
  }));
}

export function buildCurrentVerticalProfilePoint(
  flight: ReplayFlight,
  currentReplayTime: number,
): VerticalProfilePoint | null {
  const aircraftState = interpolateFlightAtTime(flight, currentReplayTime);

  if (!aircraftState) {
    return null;
  }

  return {
    time: currentReplayTime,
    altitudeFt: Math.round(aircraftState.geoAltitudeMeters * METERS_TO_FEET),
    utcTime: formatUtcTime(currentReplayTime, undefined),
    elapsedLabel: formatElapsedTime(currentReplayTime, flight.firstTime),
  };
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

export function VerticalProfileChart({
  data,
  currentPoint,
  startTime,
}: {
  data: VerticalProfilePoint[];
  currentPoint: VerticalProfilePoint | null;
  startTime: number;
}) {
  if (!data.length) {
    return null;
  }

  return (
    <div className="flight-profile-section">
      <div className="flight-profile-header">
        <span>Vertical profile</span>
        {currentPoint ? <strong>{formatAltitude(currentPoint.altitudeFt)}</strong> : null}
      </div>
      <div className="flight-profile-chart" aria-label="Altitude over time">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 270, height: 164 }}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(time) => formatElapsedTime(Number(time), startTime)}
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
            {currentPoint ? (
              <>
                <ReferenceLine
                  x={currentPoint.time}
                  stroke="rgba(245, 158, 11, 0.58)"
                  strokeDasharray="3 3"
                />
                <Scatter
                  data={[currentPoint]}
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
  );
}
