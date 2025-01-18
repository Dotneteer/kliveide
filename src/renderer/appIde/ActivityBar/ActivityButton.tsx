import { useTheme } from "@renderer/theming/ThemeProvider";
import classnames from "@renderer/utils/classnames";
import { noop } from "@renderer/utils/stablerefs";
import { useState } from "react";
import { Icon } from "../../controls/Icon";
import { TooltipFactory, useTooltipRef } from "../../controls/Tooltip";
import { Activity } from "../../abstractions/Activity";
import styles from "./ActivityButton.module.scss";

/**
 * Component properties
 */
type Props = {
  activity: Activity;
  active: boolean;
  clicked?: () => void;
};

export const ActivityButton = ({ activity, active = false, clicked = noop }: Props) => {
  const ref = useTooltipRef();

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
        placement="right"
        offsetX={-8}
        offsetY={16}
        content={activity.title}
      />
      <div className={styles.iconWrapper}>
        <Icon iconName={activity.iconName} width={24} height={24} fill={iconFill} />
      </div>
    </div>
  );
};
