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

export const Text = ({ text, width, tooltip }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const toolTipLines = (tooltip ?? "").split("\n");

  return (
    <div ref={ref} className={styles.text} style={{ width }}>
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
    </>
  );
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

export const Secondary = ({ text, width }: Props) => (
  <div className={styles.secondary} style={{ width }}>
    {text}
  </div>
);

type FlagProps = {
  value?: boolean | number;
  width?: string | number;
  adjustLeft?: boolean;
  center?: boolean;
  tooltip?: string;
  clicked?: () => void;
};

export const Flag = ({
  value,
  width,
  adjustLeft = true,
  center = true,
  tooltip,
  clicked
}: FlagProps) => {
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
        marginLeft: adjustLeft ? -4 : undefined,
        cursor: clicked ? "pointer" : undefined
      }}
      onClick={() => clicked?.()}
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

export const LabelSeparator = ({ width }: { width: number | string }) => (
  <div className={styles.label} style={{ width }} />
);

type FlagRowProps = {
  flagDescriptions: string[];
  value: number;
};

export const FlagRow = ({ value, flagDescriptions }: FlagRowProps) => {
  return (
    <div className={styles.dumpSection}>
      <Flag
        value={value & 0x80}
        tooltip={`Bit 7: ${flagDescriptions?.[7] ?? ""}`}
      />
      <Flag
        value={value & 0x40}
        tooltip={`Bit 6: ${flagDescriptions?.[6] ?? ""}`}
      />
      <Flag
        value={value & 0x20}
        tooltip={`Bit 5: ${flagDescriptions?.[5] ?? ""}`}
      />
      <Flag
        value={value & 0x10}
        tooltip={`Bit 4: ${flagDescriptions?.[4] ?? ""}`}
      />
      <Flag
        value={value & 0x08}
        tooltip={`Bit 3: ${flagDescriptions?.[3] ?? ""}`}
      />
      <Flag
        value={value & 0x04}
        tooltip={`Bit 2: ${flagDescriptions?.[2] ?? ""}`}
      />
      <Flag
        value={value & 0x02}
        tooltip={`Bit 1: ${flagDescriptions?.[1] ?? ""}`}
      />
      <Flag
        value={value & 0x01}
        tooltip={`Bit 0: ${flagDescriptions?.[0] ?? ""}`}
      />
    </div>
  );
};

