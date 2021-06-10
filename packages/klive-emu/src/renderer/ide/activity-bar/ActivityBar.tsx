import * as React from "react";
import ActivityButton from "./ActivityButton";
import {
  createSizedStyledPanel,
  createUnsizedStyledPanel,
} from "../../common/PanelStyles";
import { activityService } from "./ActivityService";
import { useSelector } from "react-redux";
import { AppState } from "../../../shared/state/AppState";

/**
 * Represents the statusbar of the emulator
 */
export default function ActivityBar() {
  const activities = useSelector((s: AppState) => s?.activityBar?.activities);
  const activeIndex = useSelector((s: AppState) => s?.activityBar?.activeIndex);
  const pointedIndex = useSelector(
    (s: AppState) => s?.activityBar?.pointedIndex
  );
  const appButtons: JSX.Element[] = [];
  const sysButtons: JSX.Element[] = [];
  activities?.forEach((a, index) => {
    const destination = a.isSystemActivity ? sysButtons : appButtons;
    destination.push(
      <ActivityButton
        key={index}
        isSystem={a.isSystemActivity}
        activity={a}
        active={activeIndex === index}
        pointed={pointedIndex === index}
        clicked={() => activityService.selectActivity(index)}
        point={() => activityService.pointActivity(index)}
        unpoint={() => activityService.pointActivity(-1)}
      />
    );
  });
  return (
    <Root>
      <Buttons>{appButtons}</Buttons>
      <Gap />
      <Buttons>{sysButtons}</Buttons>
    </Root>
  );
}

// --- Component helper tags
const Root = createSizedStyledPanel({
  fitToClient: false,
  width: 48,
  others: {
    "background-color": "var(--activity-bar-background-color)",
  },
});

const Buttons = createUnsizedStyledPanel();

const Gap = createSizedStyledPanel();
