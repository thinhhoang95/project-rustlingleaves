import type { MapCoordinate } from "@/components/map-view-types";

export type ReplayMode = "simulation" | "adsb";

export type FlightPoint = {
  time: number;
  latitude: number;
  longitude: number;
  geoAltitudeMeters: number;
  breakpointMask: number;
};

export type CasProfilePoint = {
  time: number;
  casKts: number;
};

export type WaitAtcPoint = {
  source: "fix" | "ghost";
  identifier: string;
  latitude: number;
  longitude: number;
  lateralPathToken?: string;
  distanceNm?: number;
  routeIndex?: number | null;
  matchedCourseDegrees?: number | null;
  finalCourseDegrees?: number;
  downwindCourseDegrees?: number;
};

export type FinalFix = {
  identifier: string;
  latitude?: number;
  longitude?: number;
  distanceNm?: number;
  alongTrackNm?: number;
  crossTrackNm?: number;
  targetDistanceNm?: number;
  crossTrackToleranceNm?: number;
};

export type ReplayFlight = {
  id: string;
  callsign: string;
  icao24: string;
  points: FlightPoint[];
  firstTime: number;
  lastTime: number;
  operation?: "departure" | "arrival";
  runway?: string;
  departureTime?: number;
  departureTimeUtc?: string;
  arrivalTime?: number;
  arrivalTimeUtc?: string;
  lastEventTime?: number;
  lastEventTimeUtc?: string;
  fixSequence?: string[];
  fixCount?: number;
  originalFixSequence?: string[];
  originalFixCount?: number;
  waitAtcPoint?: WaitAtcPoint;
  finalFix?: FinalFix;
  casProfile?: CasProfilePoint[];
};

export type ReplayMetadata = {
  minTime: number;
  maxTime: number;
  minTimeOfDay: number;
  maxTimeOfDay: number;
  dayStartTime: number;
  flightCount: number;
};

export type AircraftState = {
  flightId: string;
  callsign: string;
  icao24: string;
  time: number;
  latitude: number;
  longitude: number;
  geoAltitudeMeters: number;
  trackDegrees: number;
  coordinate: MapCoordinate;
};

export type ReplaySnapshot = {
  time: number;
  aircraft: AircraftState[];
};

export type FlightLineFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: MapCoordinate[];
  };
  properties: {
    flightId: string;
    callsign: string;
    icao24: string;
  };
};

export type AircraftFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: MapCoordinate;
  };
  properties: {
    flightId: string;
    callsign: string;
    icao24: string;
    altitudeFt: number;
    altitudeLabel: string;
    trackDegrees: number;
  };
};

export type AircraftFeatureCollection = {
  type: "FeatureCollection";
  features: AircraftFeature[];
};

export type FlightLineFeatureCollection = {
  type: "FeatureCollection";
  features: FlightLineFeature[];
};
