import styles from "./GeneralControls.module.scss";
import { useRef } from "react";
import { TooltipFactory } from "../Tooltip";
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
  const ref = useRef<HTMLDivElement>(null);
  const toolTipLines = (tooltip ?? "").split("\n");

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
        >
          {toolTipLines.map((l, idx) => (
            <div key={idx}>{l}</div>
          ))}
        </TooltipFactory>
      )}
    </div>
  );
};
