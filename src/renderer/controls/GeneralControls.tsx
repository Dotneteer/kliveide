import { useRef, useState } from "react";
import styles from "./GeneralControls.module.scss";
import { ScrollViewer } from "./ScrollViewer";
import { TooltipFactory } from "./Tooltip";
import { Icon } from "./Icon";
import classnames from "@renderer/utils/classnames";

type PanelProps = {
  xclass?: string;
  children?: React.ReactNode
}

export const Panel = ({ children, xclass }: PanelProps) => (
  <div className={classnames(styles.panel, xclass)}>
    <ScrollViewer>{children}</ScrollViewer>
  </div>
);

export const Row = ({ children }: { children?: React.ReactNode }) => (
  <div className={styles.row}>{children}</div>
);

export const Column = ({ children }: { children?: React.ReactNode }) => (
  <div className={styles.column}>{children}</div>
);

type LabelProps = {
  text: string;
  width?: string | number;
  center?: boolean;
  tooltip?: string;
};

export const Label = ({ text, width, center, tooltip }: LabelProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const toolTipLines = (tooltip ?? "").split("\n");

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

export const Value = ({ text, width, tooltip }: LabelProps) => {
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

type LabeledTextProps = {
  labelWidth?: number;
  label: string;
  valueWidth?: number;
  value: string;
  tooltip?: string;
  valueTooltip?: string;
};

export const LabeledText = ({
  labelWidth,
  label,
  valueWidth,
  value,
  tooltip,
  valueTooltip
}: LabeledTextProps) => {
  return (
    <>
      <Label text={label} width={labelWidth} tooltip={tooltip} />
      <Value text={value} width={valueWidth} tooltip={valueTooltip} />
    </>
  );
};

type FlagProps = {
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

type LabeledFlagProps = {
  labelWidth?: number;
  label: string;
  value: boolean;
  valueWidth?: number;
  tooltip?: string;
  valueTooltip?: string;
};

export const LabeledFlag = ({
  labelWidth,
  label,
  value,
  valueWidth,
  tooltip,
  valueTooltip
}: LabeledFlagProps) => {
  return (
    <>
      <Label text={label} width={labelWidth} tooltip={tooltip} />
      <Flag value={value} tooltip={valueTooltip} width={valueWidth} />
    </>
  );
};

type ExpandableRowProps = {
  heading: string;
  children?: React.ReactNode;
  expanded?: boolean;
};

export const ExpandableRow = ({
  heading,
  children,
  expanded
}: ExpandableRowProps) => {
  const [isExpanded, setIsExpanded] = useState(expanded ?? false);
  return (
    <div className={styles.expandableRow}>
      <div
        className={styles.expandableRowHeading}
        onClick={() => {
          setIsExpanded(!isExpanded);
        }}
      >
        <span className={styles.headingText}>{heading}</span>
        <Icon
          iconName={isExpanded ? "chevron-down" : "chevron-right"}
          width={16}
          height={16}
        />
      </div>
      {isExpanded && <Column>{children}</Column>}
    </div>
  );
};
