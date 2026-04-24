"use client";

import type { MapCoordinate } from "@/components/map-view";

const EARTH_RADIUS_KM = 6371.0088;
const KM_PER_NAUTICAL_MILE = 1.852;

export type MeasureSegment = {
  index: number;
  kilometers: number;
  nauticalMiles: number;
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function getDistanceKm(from: MapCoordinate, to: MapCoordinate): number {
  const [fromLongitude, fromLatitude] = from;
  const [toLongitude, toLatitude] = to;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const fromLatitudeRadians = toRadians(fromLatitude);
  const toLatitudeRadians = toRadians(toLatitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitudeRadians) * Math.cos(toLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function buildMeasureSegments(points: MapCoordinate[]): MeasureSegment[] {
  const segments: MeasureSegment[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const kilometers = getDistanceKm(points[index - 1], points[index]);
    segments.push({
      index,
      kilometers,
      nauticalMiles: kilometers / KM_PER_NAUTICAL_MILE,
    });
  }

  return segments;
}

function formatDistance(value: number): string {
  return value >= 100 ? value.toFixed(1) : value.toFixed(2);
}

type MeasurePanelProps = {
  points: MapCoordinate[];
  segments: MeasureSegment[];
};

export default function MeasurePanel({ points, segments }: MeasurePanelProps) {
  const totalKilometers = segments.reduce((sum, segment) => sum + segment.kilometers, 0);
  const totalNauticalMiles = totalKilometers / KM_PER_NAUTICAL_MILE;

  return (
    <aside className="measure-panel" aria-label="Measure distance panel">
      <div className="measure-panel-header">
        <span>Measure</span>
        <span className="measure-panel-hint">Esc to close</span>
      </div>

      {segments.length > 0 ? (
        <div className="measure-segments">
          {segments.map((segment) => (
            <div className="measure-row" key={segment.index}>
              <span>Leg {segment.index}</span>
              <strong>
                {formatDistance(segment.kilometers)} km / {formatDistance(segment.nauticalMiles)} nm
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="measure-empty">
          {points.length === 0 ? "Click the map to start a ruler." : "Click another point to measure a segment."}
        </p>
      )}

      <div className="measure-total">
        <span>Total</span>
        <strong>
          {formatDistance(totalKilometers)} km / {formatDistance(totalNauticalMiles)} nm
        </strong>
      </div>
    </aside>
  );
}
