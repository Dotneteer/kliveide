import * as React from "react";
import { Activity } from "../../../shared/activity/Activity";
import { SvgIcon } from "../../common/SvgIcon";
import styles from "styled-components";
import { themeService } from "../../themes/theme-service";

/**
 * Component properties
 */
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
export default function ActivityButton(props: Props) {
  const style: Record<string, any> = {};
  if (props.active) {
    style.borderLeft = "2px solid white";
  }
  if (props.isSystem) {
    style.alignSelf = "flex-end";
  }
  return (
    <Root
      style={style}
      onClick={props.clicked}
      onMouseEnter={props.point}
      onMouseLeave={props.unpoint}
    >
      <SvgIcon
        iconName={props.activity.iconName}
        width={24}
        height={24}
        fill={themeService.getProperty(
          props.active || props.pointed
            ? "--activity-current-icon-color"
            : "--activity-icon-color"
        )}
      />
    </Root>
  );
}

// --- Helper component tags
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
