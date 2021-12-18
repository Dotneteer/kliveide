import * as React from "react";

import { getThemeService } from "@core/service-registry";
import { Icon } from "@components/Icon";
import { Activity } from "@core/abstractions/activity";
import { CSSProperties } from "react";

/**
 * Component properties
 */
type Props = {
  activity: Activity;
  active: boolean;
  pointed: boolean;
  isSystem: boolean;
  clicked: () => void;
  point: () => void;
  unpoint: () => void;
};

/**
 * Represents the statusbar of the emulator
 */
export const ActivityButton: React.VFC<Props> = ({
  activity,
  active,
  pointed,
  isSystem,
  clicked,
  point,
  unpoint,
}) => {
  const style: Record<string, any> = {};
  if (active) {
    style.borderLeft = "2px solid white";
  }
  if (isSystem) {
    style.alignSelf = "flex-end";
  }
  return (
    <div
      style={{ ...rootStyle, ...style }}
      onClick={clicked}
      onMouseEnter={point}
      onMouseLeave={unpoint}
      title={activity.title}
    >
      <Icon
        iconName={activity.iconName}
        width={24}
        height={24}
        fill={getThemeService().getProperty(
          active || pointed
            ? "--activity-current-icon-color"
            : "--activity-icon-color"
        )}
      />
    </div>
  );
};

const rootStyle: CSSProperties = {
  width: "100%",
  height: 48,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  cursor: "pointer",
  borderLeft: "2px solid transparent",
  borderTop: "2px solid transparent",
  borderRight: "2px solid transparent",
  borderBottom: "2px solid transparent",
  padding: 3,
};
