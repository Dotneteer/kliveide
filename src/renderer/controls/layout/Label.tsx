import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import styles from "./Layout.module.scss";

type Props = {
  text: string;
  width?: string | number;
  center?: boolean;
  tooltip?: string;
};

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
