import * as React from "react";
import { useRef, useState, useEffect } from "react";

import { getSideBarService, getState } from "@core/service-registry";
import { createSizedStyledPanel } from "@components/PanelStyles";
import { ISideBarPanel } from "@abstractions/side-bar-service";
import SideBarPanel from "./SideBarPanel";
import SideBarHeader from "./SideBarHeader";

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
  const sideBarService = getSideBarService();

  // --- Component state
  const [panels, setPanels] = useState<ISideBarPanel[]>([]);
  let activityName = "";

  // --- Set up the side bar panels with their state
  const getActiveActivity = () => {
    const activityBar = getState().activityBar;
    const currentActivity = activityBar?.activeIndex ?? -1;
    return !activityBar?.activities || currentActivity < 0
      ? null
      : activityBar.activities[currentActivity] ?? null;
  };

  const panelsChanged = () => {
    if (getActiveActivity()) {
      activityName = getActiveActivity().id;
      setPanels(sideBarService.getSideBarPanels());
    }
  };

  useEffect(() => {
    // --- Mount
    sideBarService.sideBarChanged.on(panelsChanged);
    sideBarService.refreshSideBarPanels();

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
    for (let index = 0; index < panels.length; index++) {
      const descriptor = panels[index];
      const expBefore =
        panels.filter((p, i) => i < index && p.expanded).length > 0;
      const expAfter =
        panels.filter((p, i) => i >= index && p.expanded).length > 0;
      sideBarPanels.push(
        <SideBarPanel
          key={`${activityName}-${descriptor.title}`}
          index={index}
          isLast={index === panels.length - 1}
          descriptor={descriptor}
          sizeable={expBefore && expAfter}
          heightPercentage={descriptor.heightPercentage}
          visibilityChanged={() => setPanels(panels.slice(0))}
          startResize={startResize}
          resized={resizePanel}
        />
      );
    }
  }

  return (
    getActiveActivity() && (
      <>
        <Root>
          <SideBarHeader activity={getActiveActivity()} />
          {sideBarPanels}
        </Root>
      </>
    )
  );

  /**
   * Gets the index of the previous expanded panel
   * @param index Current index
   */
  function getAboveExpandedIndex(index: number): number {
    let prevIndex = -1;
    for (let i = 0; i < index; i++) {
      if (i < index && i > prevIndex && panels[i].expanded) {
        prevIndex = i;
      }
    }
    return prevIndex;
  }

  /**
   * Gets the index of the next expanded panel
   * @param index Current index
   */
  function getSizedExpandedIndex(index: number): number {
    for (let i = index; i < panels.length; i++) {
      if (panels[i].expanded) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Starts dragging the side bar panel with the specified index
   * @param index
   */
  function startResize(index: number): void {
    if (index <= 0) return;

    sizingIndex.current = index;
    const sizedIndex = getSizedExpandedIndex(index);
    const aboveIndex = getAboveExpandedIndex(index);
    if (sizedIndex < 0 || aboveIndex < 0) {
      return;
    }

    sizedPanelHeight.current = panels[sizedIndex].height;
    abovePanelHeight.current = panels[aboveIndex].height;
    panelPercentage.current =
      panels[sizedIndex].heightPercentage + panels[aboveIndex].heightPercentage;
  }

  /**
   * Resizes the panel selected for sizing
   * @param delta Relative size change of the panel being sized
   * @returns
   */
  function resizePanel(delta: number): void {
    const index = sizingIndex.current;
    if (index <= 0 || !panels[index]) return;

    const sizedIndex = getSizedExpandedIndex(index);
    const aboveIndex = getAboveExpandedIndex(index);
    if (sizedIndex < 0 || aboveIndex < 0) {
      return;
    }

    const sizedHeight = panels[sizedIndex].height;
    const aboveHeight = panels[aboveIndex].height;
    let newSizedHeight = sizedPanelHeight.current - delta;
    let newAboveHeight = abovePanelHeight.current + delta;
    if (newSizedHeight < MIN_PANEL_HEIGHT) {
      newSizedHeight = MIN_PANEL_HEIGHT;
      newAboveHeight = aboveHeight + (sizedHeight - newSizedHeight);
    }
    if (newAboveHeight < MIN_PANEL_HEIGHT) {
      newAboveHeight = MIN_PANEL_HEIGHT;
      newSizedHeight = sizedHeight + (aboveHeight - newAboveHeight);
    }
    const sumHeight = newSizedHeight + newAboveHeight;
    const abovePercentage =
      (newAboveHeight / sumHeight) * panelPercentage.current;
    panels[aboveIndex].heightPercentage = abovePercentage;
    panels[sizedIndex].heightPercentage =
      panelPercentage.current - abovePercentage;
    setPanels(panels.slice(0));
  }
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  others: {
    "background-color": "var(--sidebar-background-color)",
  },
});
