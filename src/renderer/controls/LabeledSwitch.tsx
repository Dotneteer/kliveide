import { useRef } from "react";
import { Icon } from "./Icon";
import styles from "./LabeledSwitch.module.scss";
import { TooltipFactory } from "./Tooltip";

type Props = {
  label: string;
  title?: string;
  value: boolean;
  clicked?: (val: boolean) => void;
};

export const LabeledSwitch = ({
  label,
  title,
  value,
  clicked
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={styles.labeledSwitch}
      onClick={() => {
        clicked?.(!value);
      }}
    >
      <span className={styles.headerLabel}>{label}</span>
      <Icon
        iconName={value ? "circle-filled" : "circle-outline"}
        fill={value ? "--color-value" : "--color-command-icon"}
        width={20}
        height={20}
      />
      <div style={{width: 4}}></div>
      {title && (
        <TooltipFactory
          refElement={ref.current}
          placement='right'
          offsetX={-8}
          offsetY={32}
        >
          {title}
        </TooltipFactory>
      )}
    </div>
  );
};
