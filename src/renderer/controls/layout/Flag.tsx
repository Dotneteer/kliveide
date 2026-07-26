import { Icon } from "@renderer/controls/Icon";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
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
  clicked
}: Props) => {
  const ref = useTooltipRef();

  return (
    <div
      ref={ref}
      className={styles.flag}
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
        iconName={
          value === undefined
            ? "close"
            : value
            ? "circle-filled"
            : "circle-outline"
        }
        width={16}
        height={16}
        fill="--color-value"
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
