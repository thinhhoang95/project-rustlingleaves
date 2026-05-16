export type MapCoordinate = [number, number];

export type MapSelectionTarget = {
  id: string;
  requestId: number;
  time?: number;
  coordinates?: MapCoordinate;
  zoom?: number;
};

export type MapSearchItem = {
  id: string;
  name: string;
} & (
  | {
      type: "Waypoint" | "VOR" | "Runway";
      coordinates: MapCoordinate;
      zoom: number;
    }
  | {
      type: "Flight";
      flightId: string;
      firstTime: number;
      lastTime: number;
    }
);
