import { useRef } from "react";
import { Icon } from "./Icon";
import { TooltipFactory } from "./Tooltip";
import styles from "./Labels.module.scss";

type Props = {
  text: string;
  width?: string | number;
  center?: boolean;
  tooltip?: string;
};

export const Label = ({ text, width, center, tooltip }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const toolTipLines = (tooltip ?? "").split("\n");

  return (
    <>
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
    </>
  );
};

export const Value = ({ text, width, tooltip }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const toolTipLines = (tooltip ?? "").split("\n");

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
            {toolTipLines.map((l, idx) => (
              <div key={idx}>{l}</div>
            ))}
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
  value?: boolean | number;
  width?: string | number;
  center?: boolean;
  tooltip?: string;
};

export const Flag = ({ value, width, center = true, tooltip }: FlagProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const toolTipLines = (tooltip ?? "").split("\n");

  return (
    <div
      ref={ref}
      className={styles.flag}
      style={{
        width,
        display: "flex",
        justifyContent: center ? "center" : undefined
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

export const Separator = () => <hr className={styles.separator} />;

export const LabelSeparator = ({width}: {width: number | string}) => (
  <div className={styles.label} style={{ width }} />
);
