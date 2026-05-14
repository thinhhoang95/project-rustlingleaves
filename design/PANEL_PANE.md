# Panel Pane Behavior

The left simulation pane is a shared host for multiple panels. New simulation-related panels should look and feel like the existing `SimulationFlightDetailsPanel`: use the same side-panel shell, header treatment, compact spacing, dark translucent surface, and restrained table/detail styling so the pane reads as one coherent stack.

## Placement

Panels live inside the pane, not as independent floating overlays. The pane owns positioning, width, and vertical scrolling.

Render panels in the desired priority order. A panel that should appear beneath the selected simulation flight details should be placed immediately after `SimulationFlightDetailsPanel` in the pane markup. If `SimulationFlightDetailsPanel` is not rendered, the next visible panel naturally occupies that top position.

This is the intended behavior:

- If only `SimulationFlightDetailsPanel` is visible, it appears at the top of the pane.
- If both `SimulationFlightDetailsPanel` and another simulation panel are visible, the other panel appears directly beneath it.
- If `SimulationFlightDetailsPanel` is hidden and another simulation panel is visible, that panel moves up and appears where the flight details panel would have been.
- If several optional panels are visible, they stack in DOM order with the pane gap between them.
- If no panels are visible, the pane should disappear or remain empty according to the existing pane CSS.

Do not compute absolute offsets between panels. Do not manually dock one panel to another. The automatic docking behavior comes from normal document flow inside the pane: optional panels render or do not render, and the visible panels close the gap naturally.

## Scrolling

The pane is the scroll container. Individual panels should take their natural height and should not add their own vertical scrolling.

Avoid `max-height`, `overflow-y: auto`, or inner scroll containers inside panels unless there is a specific interaction that cannot work otherwise. Nested scrolling makes the pane difficult to use, especially when multiple panels are visible. Tables, detail lists, and summaries should expand the panel height; the user scrolls the pane to reach lower content.

Recommended panel layout rules:

- Use `flex: 0 0 auto` on each panel so it keeps natural height in the pane stack.
- Use `overflow: visible` for panel content.
- Put vertical spacing between panels on the pane container via `gap`.
- Keep table columns compact and responsive with wrapping where needed.
- Let long flight IDs, ICAO codes, and messages wrap rather than creating horizontal overflow.

## Optional Rendering

Panels may appear based on state, data availability, or active mode. This should be done with conditional rendering at the pane level or by returning `null` from the panel when it has no content.

For example, the feasibility check panel should be visible only when simulation mode is active and there are infeasible arrivals or an error to show. When the feasibility check has no issues, it should not reserve space.

The key rule for future agents: optional panels should participate in the same pane stack. Do not create a separate anchor, fixed position, or panel-specific scroll area for a new panel just because it can appear independently.
