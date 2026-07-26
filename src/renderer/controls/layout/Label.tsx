import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import styles from "./Layout.module.scss";

type Props = {
  /** Label text rendered in the aligned cell. */
  text: string;
  /** Explicit label cell width. */
  width?: string | number;
  /** Centers label text within the cell when true. */
  center?: boolean;
  /** Optional tooltip shown for the label cell. */
  tooltip?: string;
};

/**
 * Provides fixed-width label text for aligned key-value rows.
 */
export const Label = ({ text, width, center, tooltip }: Props) => {
  const ref = useTooltipRef();

  return (
    <div
      ref={ref}
      className={styles.label}
      style={{
        width,
        justifyContent: center ? "center" : undefined
      }}
    >
      {text}
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={0}
          offsetY={0}
          showDelay={100}
          content={tooltip}
        />
      )}
    </div>
  );
};
