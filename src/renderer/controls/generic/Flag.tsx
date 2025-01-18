import styles from "./GeneralControls.module.scss";
import { useRef } from "react";
import { TooltipFactory, useTooltipRef } from "../Tooltip";
import { Icon } from "../Icon";

type Props = {
  value?: boolean | number;
  width?: string | number;
  adjustLeft?: boolean;
  center?: boolean;
  tooltip?: string;
};

export const Flag = ({
  value,
  width,
  adjustLeft = true,
  center = true,
  tooltip
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
        marginLeft: adjustLeft ? "-0.2em" : undefined
      }}
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
        fill='--color-value'
      />
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement='bottom'
          offsetX={0}
          offsetY={16}
          showDelay={100}
          content={tooltip}
        />
      )}
    </div>
  );
};
