import * as React from "react";
import { SvgIcon } from "../../common-ui/SvgIcon";
import styles from "styled-components";
import { getThemeService } from "@abstractions/service-helpers";
import { Activity } from "@abstractions/activity";

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
export default function ActivityButton({
  activity,
  active,
  pointed,
  isSystem,
  clicked,
  point,
  unpoint
}: Props) {
  const style: Record<string, any> = {};
  if (active) {
    style.borderLeft = "2px solid white";
  }
  if (isSystem) {
    style.alignSelf = "flex-end";
  }
  return (
    <Root
      style={style}
      onClick={clicked}
      onMouseEnter={point}
      onMouseLeave={unpoint}
      title={activity.title}
    >
      <SvgIcon
        iconName={activity.iconName}
        width={24}
        height={24}
        fill={getThemeService().getProperty(
          active || pointed
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
