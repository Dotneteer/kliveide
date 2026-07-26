import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import styles from "./Layout.module.scss";

type Props = {
  /** Value text rendered in the aligned cell. */
  text: string;
  /** Explicit value cell width. */
  width?: string | number;
  /** Optional tooltip shown for the value cell. */
  tooltip?: string;
};

/**
 * Provides fixed-width value text for aligned key-value rows.
 */
export const Value = ({ text, width, tooltip }: Props) => {
  const ref = useTooltipRef();

  return (
    <div ref={ref} className={styles.value} style={{ width }}>
      {text}
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={-8}
          offsetY={24}
          showDelay={100}
          content={tooltip}
        />
      )}
    </div>
  );
};
