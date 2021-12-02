import * as React from "react";
import { useSelector } from "react-redux";

import { dispatch, getState } from "@core/service-registry";
import { AppState } from "@state/AppState";
import {
  changeActivityAction,
  pointActivityAction,
} from "@state/activity-bar-reducer";
import ActivityButton from "./ActivityButton";
import { Column, Row } from "@components/Panels";
import { emuShowSidebarAction } from "@core/state/emu-view-options-reducer";

/**
 * Represents the statusbar of the emulator
 */
export default function ActivityBar() {
  // --- Selectors
  const activities = useSelector((s: AppState) => s?.activityBar?.activities);
  const activeIndex = useSelector((s: AppState) => s?.activityBar?.activeIndex);
  const pointedIndex = useSelector(
    (s: AppState) => s?.activityBar?.pointedIndex
  );
  
  // --- Buttons to display
  const appButtons: JSX.Element[] = [];
  const sysButtons: JSX.Element[] = [];

  // --- Create the buttons to display
  activities?.forEach((a, index) => {
    const destination = a.isSystemActivity ? sysButtons : appButtons;
    destination.push(
      <ActivityButton
        key={index}
        isSystem={a.isSystemActivity}
        activity={a}
        active={activeIndex === index}
        pointed={pointedIndex === index}
        clicked={() => handleButtonClick(index)}
        point={() => dispatch(pointActivityAction(index))}
        unpoint={() => dispatch(pointActivityAction(-1))}
      />
    );
  });

  // --- Render the activity bar
  return (
    <Column
      width={48}
      style={{
        backgroundColor: "var(--activity-bar-background-color)",
        flexDirection: "column",
      }}
    >
      <Row height="auto" style={{flexDirection: "column"}} >{appButtons}</Row>
      <Row />
      <Row height="auto" style={{flexDirection: "column"}} >{sysButtons}</Row>
    </Column>
  );

  /**
   * Handles clicking an activity button
   * @param index Activity index clicked
   */
  function handleButtonClick(index: number): void {
    const state = getState();
    const currentIndex = state.activityBar?.activeIndex ?? -1;
    if (index >= 0) {
      if (index !== currentIndex) {
        dispatch(changeActivityAction(index))
        dispatch(emuShowSidebarAction(true))
      } else {
        dispatch(emuShowSidebarAction(!state.emuViewOptions.showSidebar))
      }
    }
  }
}
