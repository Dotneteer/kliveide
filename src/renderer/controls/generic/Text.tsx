import styles from "./GeneralControls.module.scss";
import { TooltipFactory, useTooltipRef } from "../Tooltip";
import classnames from "classnames";

type Props = {
  text: string;
  width?: string | number;
  center?: boolean;
  tooltip?: string;
  variant?: string;
};

export const Text = ({ text, width, center, tooltip, variant }: Props) => {
  const ref = useTooltipRef();

  return (
    <div
      ref={ref}
      className={classnames(styles.text, {
        [styles.error]: variant === "error",
        [styles.warning]: variant === "warning",
        [styles.success]: variant === "success",
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
          placement='right'
          offsetX={0}
          offsetY={0}
          showDelay={100}
          content={tooltip}
        />
      )}
    </div>
  );
};
