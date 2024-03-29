import styles from "./GeneralControls.module.scss";
import { useRef } from "react";
import { TooltipFactory } from "../Tooltip";
import classnames from "@renderer/utils/classnames";

type Props = {
  text: string;
  width?: string | number;
  center?: boolean;
  tooltip?: string;
  variant?: string;
};

export const Text = ({ text, width, center, tooltip, variant }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const toolTipLines = (tooltip ?? "").split("\n");

  return (
    <div
      ref={ref}
      className={classnames(styles.text, {
        [styles.error]: variant === "error",
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
        >
          {toolTipLines.map((l, idx) => (
            <div key={idx}>{l}</div>
          ))}
        </TooltipFactory>
      )}
    </div>
  );
};
