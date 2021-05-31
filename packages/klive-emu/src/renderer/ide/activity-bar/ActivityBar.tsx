import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../../shared/state/AppState";
import { Activity } from "../../../shared/activity/Activity";
import ActivityButton from "./ActivityButton";
import { createSizedStyledPanel, createUnsizedStyledPanel } from "../../common/PanelStyles";
import { activityService } from "./ActivityService";

const Root = createSizedStyledPanel({
  fitToClient: false,
  width: 48,
  others: {
    "background-color": "var(--activity-bar-background-color)"  
  }
})
const Buttons = createUnsizedStyledPanel();
const Gap = createSizedStyledPanel();

interface Props {
  activities?: Activity[];
  activeIndex: number;
  pointedIndex: number;
}

/**
 * Represents the statusbar of the emulator
 */
class ActivityBar extends React.Component<Props> {
  static defaultProps: Props = {
    activeIndex: -1,
    pointedIndex: -1
  }
  constructor(props: Props) {
    super(props);
  }

  render() {
    const appButtons: JSX.Element[] = [];
    const sysButtons: JSX.Element[] = [];
    this.props?.activities?.forEach((a, index) => {
      const destination = a.isSystemActivity ? sysButtons : appButtons;
      destination.push(
        <ActivityButton
          key={index}
          isSystem={a.isSystemActivity}
          activity={a}
          active={this.props.activeIndex === index}
          pointed={this.props.pointedIndex === index}
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
}

export default connect((state: AppState) => {
  return {
    activities: state?.activityBar?.activities,
    activeIndex: state?.activityBar?.activeIndex ?? -1,
    pointedIndex: state?.activityBar?.pointedIndex ?? -1,
  };
}, null)(ActivityBar);
