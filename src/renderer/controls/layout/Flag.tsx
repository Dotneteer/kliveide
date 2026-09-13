import { Icon } from "@renderer/controls/Icon";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import classnames from "classnames";
import styles from "./Layout.module.scss";

type Props = {
  /** Flag state rendered as filled, outline, or close indicator. */
  value?: boolean | number;
  /** Explicit flag cell width. */
  width?: string | number;
  /** Applies the default left offset used by compact flag rows. */
  adjustLeft?: boolean;
  /** Centers the icon within the flag cell when true. */
  center?: boolean;
  /** Optional tooltip shown for the flag cell. */
  tooltip?: string;
  /** Optional click handler for interactive flag cells. */
  clicked?: () => void;
  /**
   * The theme property the indicator is filled with. Defaults to the neutral `--color-value`, which
   * is what all 70-odd existing call sites get; a converted panel passes `--color-state-value` to
   * opt in. Same shape as `iconFill` on `controls/data/registers`' flag components.
   */
  iconFill?: string;
  /**
   * Extra class merged onto the flag cell, for a caller that needs the indicator on its own column
   * grid. `Label`/`Value`/`Secondary` all take one; this did not, so a panel could not put the dot
   * anywhere but where this component's own padding left it.
   *
   * Note that `width`, `justifyContent` and `marginLeft` below are *inline* styles and so beat any
   * class: leave the `width` prop off and pass `adjustLeft={false}` if the class is to own those.
   */
  className?: string;
};

/**
 * Provides a compact boolean or bit-state indicator for aligned control rows.
 */
export const Flag = ({
  value,
  width,
  adjustLeft = true,
  center = true,
  tooltip,
  clicked,
  iconFill,
  className
}: Props) => {
  const ref = useTooltipRef();

  return (
    <div
      ref={ref}
      className={classnames(styles.flag, className)}
      style={{
        width,
        display: "flex",
        justifyContent: center ? "center" : undefined,
        marginLeft: adjustLeft ? "-0.2em" : undefined,
        cursor: clicked ? "pointer" : undefined
      }}
      onClick={() => clicked?.()}
    >
      <Icon
        iconName={value === undefined ? "close" : value ? "circle-filled" : "circle-outline"}
        width={16}
        height={16}
        fill={iconFill ?? "--color-value"}
      />
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="bottom"
          offsetX={0}
          offsetY={16}
          showDelay={100}
          content={tooltip}
        />
      )}
    </div>
  );
};
