import { Activity } from "@/core/abstractions";
import { useTheme } from "@/theming/ThemeProvider";
import classnames from "@/utils/classnames";
import { noop } from "@/utils/stablerefs";
import { useRef, useState } from "react";
import { Icon } from "../../controls/common/Icon";
import { TooltipFactory } from "../../controls/common/Tooltip";
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
  clicked = noop
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  const [pointed, setPointed] = useState(false);
  const theme = useTheme();
  const iconFill = theme.getThemeProperty(
    pointed || active ? "--color-activitybar-active" : "--color-activitybar"
  );
  return (
    <div
      ref={ref}
      className={classnames(styles.activityButton, { [styles.active]: active })}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
      onClick={clicked}
    >
      <TooltipFactory
        refElement={ref.current}
        placement='right'
        offsetX={-8}
        offsetY={0}
      >
        {activity.title}
      </TooltipFactory>

      <div className={styles.iconWrapper}>
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
