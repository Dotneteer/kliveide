import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { TooltipFactory } from "./Tooltip";
import styles from "./Labels.module.scss";

type Props = {
  text: string;
  width?: string | number;
  center?: boolean;
  tooltip?: string;
};

export const Label = ({ text, width, center }: Props) => (
  <div
    className={styles.label}
    style={{
      width,
      justifyContent: center ? "center" : undefined
    }}
  >
    {text}
  </div>
);

export const Value = ({ text, width, tooltip }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);
  
  useEffect(() => {
    setVersion(1);
  }, [ref.current])
  return (
    <>
      <div ref={ref} className={styles.value} style={{ width }}>
        {text}
        {tooltip && (
          <TooltipFactory
            refElement={ref.current}
            placement='bottom'
            offsetX={0}
            offsetY={16}
            showDelay={100}
          >
            {tooltip}
          </TooltipFactory>
        )}
      </div>
    </>
  );
};

export const Secondary = ({ text, width }: Props) => (
  <div className={styles.secondary} style={{ width }}>
    {text}
  </div>
);

type FlagProps = {
  value: boolean | number;
  width?: string | number;
  center?: boolean;
};

export const Flag = ({ value, width, center = true }: FlagProps) => (
  <div
    className={styles.flag}
    style={{
      width,
      display: "flex",
      justifyContent: center ? "center" : undefined
    }}
  >
    <Icon
      iconName={value ? "circle-filled" : "circle-outline"}
      width={16}
      height={16}
      fill='--color-value'
    />
  </div>
);

export const Separator = () => <hr className={styles.separator} />;
