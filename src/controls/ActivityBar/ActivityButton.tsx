import { Activity } from "@/core/abstractions";
import { useTheme } from "@/theming/ThemeProvider";
import classnames from "@/utils/classnames";
import { noop } from "@/utils/stablerefs";
import { useState } from "react";
import { Icon } from "../common/Icon";
import styles from "./ActivityButton.module.scss";

/**
 * Component properties
 */
type Props = {
    activity: Activity;
    active: boolean;
    clicked?: () => void;
  };
  
  export const ActivityButton = ({
    activity,
    active = false,
    clicked = noop,
  }: Props) => {
    const [pointed, setPointed] = useState(false);
    const theme = useTheme();
    const iconFill = theme.getThemeProperty(pointed || active
        ? "--color-fg-activitybar-active" 
        : "--color-fg-activitybar");
    return (
      <div
        className={classnames(styles.component, active 
            ? styles.active 
            : "")}
        onMouseEnter={() => setPointed(true)}
        onMouseLeave={() => setPointed(false)}
        onClick={clicked}
        title={activity.title}
      >
        <div className={classnames(styles.iconWrapper)}>
        <Icon
          iconName={activity.iconName}
          width={20}
          height={20}
          fill={iconFill}
        />
        </div>
      </div>
    );
  };