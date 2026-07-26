import classnames from "classnames";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import styles from "./Layout.module.scss";

type TextVariant = "error" | "warning" | "success";

type Props = {
  /** Text rendered in the aligned cell. */
  text: string;
  /** Explicit text cell width. */
  width?: string | number;
  /** Centers text within the cell when true. */
  center?: boolean;
  /** Optional tooltip shown for the text cell. */
  tooltip?: string;
  /** Visual state variant, such as error, warning, or success. */
  variant?: TextVariant;
};

/**
 * Provides fixed-width text content for aligned control rows.
 */
export const Text = ({ text, width, center, tooltip, variant }: Props) => {
  const ref = useTooltipRef();

  return (
    <div
      ref={ref}
      className={classnames(styles.text, {
        [styles.error]: variant === "error",
        [styles.warning]: variant === "warning",
        [styles.success]: variant === "success"
      })}
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
