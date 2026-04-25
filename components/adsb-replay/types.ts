import type { MapCoordinate } from "@/components/map-view-types";

export type ReplayMode = "simulation" | "adsb";

export type FlightPoint = {
  time: number;
  latitude: number;
  longitude: number;
  geoAltitudeMeters: number;
  breakpointMask: number;
};

export type ReplayFlight = {
  id: string;
  callsign: string;
  icao24: string;
  points: FlightPoint[];
  firstTime: number;
  lastTime: number;
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
