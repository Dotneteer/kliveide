import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import { Activity } from "../../shared/activity/Activity";
import ActivityButton from "./ActivityButton";

import styles from "styled-components";

const Root = styles.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  flex-grow: 0;
  flex-shrink: 0;
  height: 100%;
  width: 48px;
  background-color: var(--activity-bar-background-color);
`;

const Buttons = styles.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  flex-grow: 0;
  flex-shrink: 0;
`;

const Gap = styles.div`
  display: flex;
  flex-grow: 1;
  flex-shrink: 1;
`;

interface Props {
  activities?: Activity[];
}

interface State {
  activeIndex: number;
  pointedIndex: number;
}

/**
 * Represents the statusbar of the emulator
 */
class ActivityBar extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      activeIndex: -1,
      pointedIndex: -1,
    };
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
          active={this.state.activeIndex === index}
          pointed={this.state.pointedIndex === index}
          clicked={() => this.handleClicked(index)}
          point={() => this.handlePointed(index)}
          unpoint={this.handleUnpointed}
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

  handleClicked = (index: number) => {
    this.setState({
      activeIndex: index,
    });
  };

  handlePointed = (index: number) => {
    this.setState({
      pointedIndex: index,
    });
  };

  handleUnpointed = () => {
    this.setState({
      pointedIndex: -1,
    });
  };
}

export default connect((state: AppState) => {
  return {
    activities: state?.activityBar?.activities,
  };
}, null)(ActivityBar);
