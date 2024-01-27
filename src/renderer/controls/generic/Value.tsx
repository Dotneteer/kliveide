import styles from "./GeneralControls.module.scss";
import { useRef } from "react";
import { TooltipFactory } from "../Tooltip";

type Props = {
  text: string;
  width?: string | number;
  center?: boolean;
  tooltip?: string;
};

export const Value = ({ text, width, tooltip }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const toolTipLines = (tooltip ?? "").split("\n");

  return (
    <div ref={ref} className={styles.value} style={{ width }}>
      {text}
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement='right'
          offsetX={-8}
          offsetY={24}
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
