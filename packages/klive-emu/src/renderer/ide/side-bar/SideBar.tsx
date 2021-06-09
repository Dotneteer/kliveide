import * as React from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import SideBarPanel from "./SideBarPanel";
import { ISideBarPanel, sideBarService } from "./SideBarService";
import { SideBarState } from "../../../shared/state/AppState";
import { ideStore } from "../ideStore";
import { setSideBarStateAction } from "../../../shared/state/side-bar-reducer";
import { useRef, useState } from "react";
import { animationTick } from "../../../renderer/common/utils";

const MIN_PANEL_HEIGHT = 100;

/**
 * Represents the side bar of the IDE.
 */
export default function SideBar() {
  // --- Store the state of panels while resizing
  const sizingIndex = useRef(-1);
  const sizedPanelHeight = useRef(-1);
  const abovePanelHeight = useRef(-1);
  const panelPercentage = useRef(-1);

  // --- Component state
  const [panels, setPanels] = useState<ISideBarPanel[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

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
          heightPercentage={descriptor.heightPercentage}
          visibilityChanged={() => {
            setRefreshKey(refreshKey + 1);
          }}
          startResize={startResize}
          resized={async (delta) => await resizePanel(delta)}
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
  function startResize(index: number): void {
    if (index <= 0) return;

    sizingIndex.current = index;
    sizedPanelHeight.current = panels[index].height;
    abovePanelHeight.current = panels[index - 1].height;
    panelPercentage.current =
      panels[index].heightPercentage + panels[index - 1].heightPercentage;
    console.log(
      abovePanelHeight.current,
      sizedPanelHeight.current,
      panelPercentage.current
    );
  }

  /**
   * Stops dragging the side bar panel with the specified index
   */
  function endDrag(): void {}

  // --- Resizes the specified panel
  async function resizePanel(delta: number): Promise<void> {
    const index = sizingIndex.current;
    if (index <= 0 || !panels[index]) return;

    await animationTick();
    const height = panels[index].height;
    const prevHeight = panels[index - 1].height;
    let newHeight = sizedPanelHeight.current - delta;
    let newPrevHeight = abovePanelHeight.current + delta;
    if (newHeight < MIN_PANEL_HEIGHT) {
      newHeight = MIN_PANEL_HEIGHT;
      newPrevHeight = prevHeight + (height - newHeight);
    }
    if (newPrevHeight < MIN_PANEL_HEIGHT) {
      newPrevHeight = MIN_PANEL_HEIGHT;
      newHeight = height + (prevHeight - newPrevHeight);
    }
    const sumHeight = newHeight + newPrevHeight;
    const abovePercentage = newPrevHeight/sumHeight * panelPercentage.current;
    panels[index -1].heightPercentage = abovePercentage;
    const sizedPercentage = panelPercentage.current - abovePercentage;
    panels[index].heightPercentage = sizedPercentage;
    console.log(abovePercentage, sizedPercentage);
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
