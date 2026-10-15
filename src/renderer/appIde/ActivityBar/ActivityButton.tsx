import classnames from "classnames";
import { noop } from "@renderer/utils/stablerefs";
import { Icon } from "../../controls/Icon";
import { TooltipFactory, useTooltipRef } from "../../controls/Tooltip";
import styles from "./ActivityButton.module.scss";

/**
 * Component properties
 */
type Props = {
  title: string;
  iconName: string;
  /**
   * An activity is a tab (`aria-selected` tracks `active`); a command button at the foot of the
   * bar, such as Settings, is a plain button and never shows as active.
   */
  kind?: "tab" | "command";
  active?: boolean;
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
export const ActivityButton = ({
  title,
  iconName,
  kind = "tab",
  active = false,
  clicked = noop
}: Props) => {
  const ref = useTooltipRef<HTMLButtonElement>();
  const isTab = kind === "tab";

  return (
    <button
      ref={ref}
      type="button"
      role={isTab ? "tab" : undefined}
      aria-selected={isTab ? active : undefined}
      aria-label={title}
      className={classnames(styles.activityButton, { [styles.active]: isTab && active })}
      onClick={clicked}
    >
      <TooltipFactory
        refElement={ref.current}
        placement="right"
        offsetX={-8}
        offsetY={16}
        content={title}
      />
      <div className={styles.iconWrapper}>
        <Icon iconName={iconName} width={24} height={24} fill="currentColor" />
      </div>
    </button>
  );
};
