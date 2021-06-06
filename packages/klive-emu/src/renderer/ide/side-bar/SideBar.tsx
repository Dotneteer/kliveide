import * as React from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import SideBarPanel from "./SideBarPanel";
import { ISideBarPanel, sideBarService } from "./SideBarService";
import { SideBarState } from "../../../shared/state/AppState";
import { ideStore } from "../ideStore";
import { setSideBarStateAction } from "../../../shared/state/side-bar-reducer";
import { useState } from "react";
import { animationTick } from "../../../renderer/common/utils";

const MIN_PANEL_HEIGHT = 100;

/**
 * Represents the side bar of the IDE.
 */
export default function SideBar() {
  const [panels, setPanels] = useState<ISideBarPanel[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  console.log("Render");

  // --- Save the states of the side bar panels before navigating away
  sideBarService.sideBarChanging.on(() => {
    const state: SideBarState = {};
    const panels = sideBarService.getSideBarPanels();
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      state[getPanelId(panel, i)] = panel.getPanelState() ?? {};
    }
    if (sideBarService.activity) {
      const fullState = Object.assign({}, ideStore.getState().sideBar ?? {}, {
        [sideBarService.activity]: state,
      });
      ideStore.dispatch(setSideBarStateAction(fullState));
    }
  });

  // --- Set up the side bar panels with their state
  sideBarService.sideBarChanged.on(() => {
    const panels = sideBarService.getSideBarPanels();
    const sideBarState = (ideStore.getState().sideBar ?? {})[
      sideBarService.activity
    ];
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const panelState = sideBarState?.[getPanelId(panel, i)];
      if (panelState) {
        panel.setPanelState(panelState);
      }
    }
    setPanels(panels);
  });

  /**
   * We use the `changeCounter` field of the state to re-render the component any
   * time a panel is expanded or collapsed.
   */
  let sideBarPanels: React.ReactNode[] = [];
  if (panels) {
    // --- Let's collect all side bar panels registered with the current activity
    // --- and calculate if they are sizable
    let prevExpanded = false;
    for (let index = 0; index < panels.length; index++) {
      const descriptor = panels[index];
      sideBarPanels.push(
        <SideBarPanel
          key={index}
          index={index}
          descriptor={descriptor}
          sizeable={prevExpanded && descriptor.expanded}
          panelHeight={descriptor.height}
          visibilityChanged={() => {
            setRefreshKey(refreshKey + 1);
          }}
          resized={async (index, delta) => await resizePanel(index, delta)}
        />
      );
      prevExpanded = descriptor.expanded;
    }
  }
  return <Root data-initial-size={200}>{sideBarPanels}</Root>;

  // --- Helper to calculate panel ID
  function getPanelId(panel: ISideBarPanel, index: number): string {
    return `${sideBarService.activity}-${index}`;
  }

  /**
   * Starts dragging the side bar panel with the specified index
   * @param index
   */
  function startDrag(index: number): void {}

  /**
   * Stops dragging the side bar panel with the specified index
   */
  function endDrag(): void {}

  // --- Resizes the specified panel
  async function resizePanel(index: number, delta: number): Promise<void> {
    if (index <= 0 || !panels[index]) return;
    await animationTick();
    const height = panels[index].height;
    const prevHeight = panels[index - 1].height;
    let newHeight = height - delta;
    let newPrevHeight = prevHeight + delta;
    if (newHeight < MIN_PANEL_HEIGHT) {
      newHeight = MIN_PANEL_HEIGHT;
      newPrevHeight = prevHeight + (height - newHeight);
    }
    if (newPrevHeight < MIN_PANEL_HEIGHT) {
      newPrevHeight = MIN_PANEL_HEIGHT;
      newHeight = height + (prevHeight - newPrevHeight);
    }
    const sumHeight = newHeight + newPrevHeight;

    console.log(delta, sumHeight, newPrevHeight, newHeight);
    setPanels(panels.slice(0));
  }
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  splitsVertical: true,
  fitToClient: false,
  others: {
    "background-color": "var(--sidebar-background-color)",
  },
});
