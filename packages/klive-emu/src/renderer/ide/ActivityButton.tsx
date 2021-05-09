import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import { Activity } from "../../shared/activity/Activity";
import { SvgIcon } from "../common/SvgIcon";
import styles from "styled-components";
import { themeService } from "../themes/theme-service";

const Root = styles.div`
  width: 100%;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  border: 2px solid transparent;
  padding: 3px;
`;

interface Props {
  activity: Activity;
  active: boolean;
  pointed: boolean;
  isSystem: boolean;
  clicked: () => void;
  point: () => void;
  unpoint: () => void;
}

/**
 * Represents the statusbar of the emulator
 */
class ActivityButton extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const style: Record<string, any> = {}
    if (this.props.active) {
      style.borderLeft = "2px solid white";
    }
    if (this.props.isSystem) {
      style.alignSelf = "flex-end";
    }
    return (
      <Root
        style={style}
        onClick={this.props.clicked}
        onMouseEnter={this.props.point}
        onMouseLeave={this.props.unpoint}
      >
        <SvgIcon
          iconName={this.props.activity.iconName}
          width={24}
          height={24}
          fill={themeService.getProperty(
            this.props.active || this.props.pointed
              ? "--activity-current-icon-color"
              : "--activity-icon-color"
          )}
        />
      </Root>
    );
  }
}

export default connect((state: AppState) => {
  return {
    activities: state?.activityBar?.activities,
  };
}, null)(ActivityButton);
