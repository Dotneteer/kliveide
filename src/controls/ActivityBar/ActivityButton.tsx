import { Activity } from "@/core/abstractions";
import { useTheme } from "@/theming/ThemeProvider";
import classnames from "@/utils/classnames";
import { noop } from "@/utils/stablerefs";
import { useRef, useState } from "react";
import { Icon } from "../common/Icon";
import { TooltipFactory } from "../common/Tooltip";
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
    const ref = useRef<HTMLDivElement>(null);

    const [pointed, setPointed] = useState(false);
    const theme = useTheme();
    const iconFill = theme.getThemeProperty(pointed || active
        ? "--color-fg-activitybar-active" 
        : "--color-fg-activitybar");
    return (
      <div
        ref={ref}
        className={classnames(styles.component, active 
            ? styles.active 
            : "")}
        onMouseEnter={() => setPointed(true)}
        onMouseLeave={() => setPointed(false)}
        onClick={clicked}
      >
        <TooltipFactory 
          refElement={ref.current}
          placement="right"
          offsetX={-8}
          offsetY={24}>
            {activity.title}            
        </TooltipFactory>
        
        <div className={classnames(styles.iconWrapper)}>
        <Icon
          iconName={activity.iconName}
          width={24}
          height={24}
          fill={iconFill}
        />
        </div>
      </div>
    );
  };