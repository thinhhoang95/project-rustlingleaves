"use client";

import { useState } from "react";
import ViewOptionsControl from "@/components/ViewOptionsControl";

type BottomControlsGroupProps = {
  showAirspaceDisplayToggle?: boolean;
};

export default function BottomControlsGroup({
  showAirspaceDisplayToggle: _showAirspaceDisplayToggle = false,
}: BottomControlsGroupProps) {
  const [showLinks, setShowLinks] = useState(false);
  const [showWaypoints, setShowWaypoints] = useState(true);

  return (
    <div className="view-options-anchor">
      <ViewOptionsControl
        showLinks={showLinks}
        onToggleLinks={() => setShowLinks((previous) => !previous)}
        showWaypoints={showWaypoints}
        onToggleWaypoints={() => setShowWaypoints((previous) => !previous)}
      />
    </div>
  );
}
