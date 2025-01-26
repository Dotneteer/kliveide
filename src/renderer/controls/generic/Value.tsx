import styles from "./GeneralControls.module.scss";
import { TooltipFactory, useTooltipRef } from "../Tooltip";

type Props = {
  text: string;
  width?: string | number;
  center?: boolean;
  tooltip?: string;
};

export const Value = ({ text, width, tooltip }: Props) => {
  const ref = useTooltipRef();

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
          content={tooltip}
        />
      )}
    </div>
  );
};
