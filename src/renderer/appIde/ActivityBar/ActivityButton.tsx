import classnames from "classnames";
import { noop } from "@renderer/utils/stablerefs";
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

/**
 * One entry in the activity bar.
 *
 * A real `<button>` with `role="tab"`: the activity bar is a tab list, and it previously had no
 * keyboard path at all — an unfocusable `<div>` with an `onClick`, no `tabIndex`, no `role` and no
 * accessible name beyond a custom tooltip.
 *
 * Hover is CSS. The icon colour used to be resolved in JS from a `pointed` state, which meant the
 * hover treatment could not transition and lived in a different place from every other hover in the
 * app; `currentColor` now carries it.
 */
export const ActivityButton = ({ activity, active = false, clicked = noop }: Props) => {
  const ref = useTooltipRef<HTMLButtonElement>();

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={activity.title}
      className={classnames(styles.activityButton, { [styles.active]: active })}
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
        <Icon iconName={activity.iconName} width={24} height={24} fill="currentColor" />
      </div>
    </button>
  );
};
