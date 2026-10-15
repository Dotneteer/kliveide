import type { MouseEvent } from "react";
import classnames from "classnames";
import { Icon } from "./Icon";
import styles from "./ToolbarSplitButton.module.scss";
import { iconSizes } from "@renderer/theming/tokens/dimensions";
import { SECONDARY_ICON_SIZE } from "./toolbar-constants";

type Props = {
  iconName: string;
  iconSize?: number;
  fill?: string;
  title?: string;
  enable?: boolean;
  /** Draws the pressed ring `IconButton` uses for a toggle that is on. */
  selected?: boolean;
  clicked?: (event: MouseEvent<HTMLButtonElement>) => void;
  dropdownTitle: string;
  /** Receives the chevron's click, so the caller can anchor its own menu on `currentTarget`. */
  dropdownClicked: (event: MouseEvent<HTMLButtonElement>) => void;
};

/**
 * An action button with a chevron beside it, in the run/debug `ToolbarSplitButton`'s frame.
 *
 * `ToolbarSplitButton` owns its menu: a list of options, one of which the main button runs. The
 * sound and recording groups do not fit that shape. Their main button toggles (mute, record), and
 * their chevron opens a menu that is not a choice of main action (sound levels, recording
 * settings). This component takes only the look, the shared frame and the narrow chevron, and
 * leaves both clicks to the caller.
 */
export const ToolbarSplitAction = ({
  iconName,
  iconSize = SECONDARY_ICON_SIZE,
  fill,
  title,
  enable = true,
  selected,
  clicked,
  dropdownTitle,
  dropdownClicked
}: Props) => (
  <div className={styles.splitButton}>
    <button
      className={styles.primaryButton}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={selected}
      disabled={!enable}
      onClick={(event) => clicked?.(event)}
    >
      <span className={classnames(styles.ring, { [styles.ringSelected]: selected })}>
        <Icon
          iconName={iconName}
          fill={enable ? fill : "--text-disabled"}
          width={iconSize}
          height={iconSize}
        />
      </span>
    </button>
    <button
      className={styles.dropdownButton}
      type="button"
      title={dropdownTitle}
      aria-label={dropdownTitle}
      aria-haspopup="menu"
      disabled={!enable}
      onClick={dropdownClicked}
    >
      <Icon
        iconName="chevron-down"
        fill={enable ? "--color-toolbarbutton" : "--bgcolor-toolbarbutton-disabled"}
        width={iconSizes.xs}
        height={iconSizes.xs}
      />
    </button>
  </div>
);
