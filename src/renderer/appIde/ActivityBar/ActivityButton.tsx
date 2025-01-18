import { useTheme } from "@renderer/theming/ThemeProvider";
import classnames from "@renderer/utils/classnames";
import { noop } from "@renderer/utils/stablerefs";
import { useRef, useState } from "react";
import { Icon } from "../../controls/Icon";
import { Activity } from "../../abstractions/Activity";
import styles from "./ActivityButton.module.scss";
import { Tooltip, useTooltipId } from "@renderer/controls/Tooltip2";

/**
 * Component properties
 */
type Props = {
  activity: Activity;
  active: boolean;
  clicked?: () => void;
};

export const ActivityButton = ({ activity, active = false, clicked = noop }: Props) => {
  const tooltipId = useTooltipId();

  const [pointed, setPointed] = useState(false);
  const theme = useTheme();
  const iconFill = theme.getThemeProperty(
    pointed || active ? "--color-activitybar-active" : "--color-activitybar"
  );
  return (
    <div
      id={tooltipId.current}
      className={classnames(styles.activityButton, { [styles.active]: active })}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
      onClick={clicked}
    >
      <Tooltip
        anchorId={tooltipId.current}
        delayShow={800}
        place="right"
        content={activity.title}
        offset={-8}
      />
      <div className={styles.iconWrapper}>
        <Icon iconName={activity.iconName} width={24} height={24} fill={iconFill} />
      </div>
    </div>
  );
};
