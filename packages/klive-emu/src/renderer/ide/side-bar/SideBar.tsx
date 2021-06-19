import * as React from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import SideBarPanel from "./SideBarPanel";
import { ISideBarPanel, sideBarService } from "./SideBarService";
import { useRef, useState, useEffect } from "react";

/**
 * The minimum height an expanded panel can have
 */
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

  // --- Set up the side bar panels with their state
  const panelsChanged = () => {
    setPanels(sideBarService.getSideBarPanels());
  };

  useEffect(() => {
    // --- Mount
    sideBarService.sideBarChanged.on(panelsChanged);

    return () => {
      // --- Unmount
      sideBarService.sideBarChanged.off(panelsChanged);
    };
  });

  // --- Render the side bar panels
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
          visibilityChanged={() => setPanels(panels.slice(0))}
          startResize={startResize}
          resized={resizePanel}
        />
      );
      prevExpanded = descriptor.expanded;
    }
  }
  return <Root data-initial-size={200}>{sideBarPanels}</Root>;

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
  }

  /**
   * Resizes the panel selected for sizing
   * @param delta Relative size change of the panel being sized
   * @returns
   */
  function resizePanel(delta: number): void {
    const index = sizingIndex.current;
    if (index <= 0 || !panels[index]) return;

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
    const abovePercentage =
      (newPrevHeight / sumHeight) * panelPercentage.current;
    panels[index - 1].heightPercentage = abovePercentage;
    panels[index].heightPercentage = panelPercentage.current - abovePercentage;
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
