import { toBin16, toBin8, toHexa4, toHexa2 } from "@renderer/appIde/services/ide-commands";
import { TooltipFactory, useTooltipRef } from "../Tooltip";
import { Icon } from "../Icon";
import styles from "./Values.module.scss";
import { useMemo, memo } from "react";
import classnames from "classnames";
import { Col } from "./Layout";
import { FlagRow, Label } from "../Labels";

type Props = {
  label: string;
  reg16Label?: string;
  reg8LLabel?: string;
  reg8HLabel?: string;
  value: number;
  tooltip?: string;
};

export const Bit16Value = memo(
  ({ label, tooltip, reg16Label, reg8LLabel, reg8HLabel, value }: Props) => {
    const ref = useTooltipRef();

    const tooltipText = useMemo(() => {
      if (!tooltip) return null;

      const r16Value = value & 0xffff;
      const r8LValue = value & 0xff;
      const r8HValue = (value >> 8) & 0xff;

      // Use a single pass replacement with a map for better performance
      const replacements = {
        "{r16N}": reg16Label || "",
        "{r8HN}": reg8HLabel || "",
        "{r8LN}": reg8LLabel || "",
        "{r16v}": `${r16Value.toString()}, ${toBin16(r16Value)}`,
        "{r8Lv}": `${r8LValue.toString()}, ${toBin8(r8LValue)}`,
        "{r8Hv}": `${r8HValue.toString()}, ${toBin8(r8HValue)}`
      };

      return tooltip.replace(
        /{r16N}|{r8HN}|{r8LN}|{r16v}|{r8Lv}|{r8Hv}/g,
        (match) => replacements[match] || match
      );
    }, [tooltip, reg16Label, reg8LLabel, reg8HLabel, value]);

    const displayValue = useMemo(() => {
      return value !== undefined ? toHexa4(value) : "----";
    }, [value]);

    return (
      <div ref={ref} className={styles.cols}>
        <div className={styles.label}>
          {label}
          {tooltip && (
            <TooltipFactory
              refElement={ref.current}
              placement="right"
              offsetX={-8}
              offsetY={0}
              showDelay={100}
              content={tooltipText}
            />
          )}
        </div>
        <div className={styles.value}>{displayValue}</div>
      </div>
    );
  }
);

type Bit8Props = {
  label: string;
  value: number;
  tooltip?: string;
};

export const Bit8Value = memo(({ label, tooltip, value }: Bit8Props) => {
  const ref = useTooltipRef();

  const tooltipText = useMemo(() => {
    if (!tooltip) return null;

    const r8Value = value & 0xff;

    // Use a single pass replacement for 8-bit values
    const replacements = {
      "{r8v}": `${r8Value.toString()}, ${toBin8(r8Value)}`,
      "{r8N}": label
    };

    return tooltip.replace(/{r8v}|{r8N}/g, (match) => replacements[match] || match);
  }, [tooltip, value]);

  const displayValue = useMemo(() => {
    return value !== undefined ? toHexa2(value) : "--";
  }, [value]);

  return (
    <div ref={ref} className={styles.cols}>
      <div className={styles.label}>
        {label}
        {tooltip && (
          <TooltipFactory
            refElement={ref.current}
            placement="right"
            offsetX={-24}
            offsetY={0}
            showDelay={100}
            content={tooltipText}
          />
        )}
      </div>
      <div className={styles.value}>{displayValue}</div>
    </div>
  );
});

type SimpleProps = {
  label: string;
  value: number | string;
  tooltip?: string;
  fullWidth?: boolean;
};

export const SimpleValue = memo(({ label, tooltip, value, fullWidth = false }: SimpleProps) => {
  const ref = useTooltipRef();

  const displayValue = useMemo(() => {
    return value !== undefined ? value.toString() : "--";
  }, [value]);

  return (
    <div ref={ref} className={styles.cols}>
      <div className={styles.label}>
        {label}
        {tooltip && (
          <TooltipFactory
            refElement={ref.current}
            placement="right"
            offsetX={fullWidth ? 8 : 0}
            offsetY={0}
            showDelay={100}
            content={tooltip}
          />
        )}
      </div>
      <div className={styles.value} style={fullWidth ? { width: "auto" } : undefined}>
        {displayValue}
      </div>
    </div>
  );
});

type FlagProps = {
  label: string;
  value?: boolean | null;
  tooltip?: string;
};

export const FlagValue = memo(({ label, tooltip, value }: FlagProps) => {
  const ref = useTooltipRef();

  const iconName = useMemo(() => {
    if (value === undefined || value === null) return "close";
    return value ? "circle-filled" : "circle-outline";
  }, [value]);

  return (
    <div ref={ref} className={styles.cols}>
      <div className={classnames(styles.label, styles.flag)}>
        {label}
        {tooltip && (
          <TooltipFactory
            refElement={ref.current}
            placement="right"
            offsetX={-32}
            offsetY={0}
            showDelay={100}
            content={tooltip}
          />
        )}
      </div>
      <div className={classnames(styles.value, styles.flag)}>
        <Icon iconName={iconName} width={16} height={16} fill="--color-value" />
      </div>
    </div>
  );
});

export const VerticalFlagValue = memo(({ label, tooltip, value }: FlagProps) => {
  const ref = useTooltipRef();

  const iconName = useMemo(() => {
    if (value === undefined || value === null) return "close";
    return value ? "circle-filled" : "circle-outline";
  }, [value]);

  return (
    <div ref={ref} className={styles.flagRows}>
      <div className={styles.verticalLabel}>
        {label}
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
      <div className={styles.flagValue}>
        <Icon iconName={iconName} width={16} height={16} fill="--color-value" />
      </div>
    </div>
  );
});

type FlagLetterProps = {
  label: string;
};

export const FlagLetter = memo(({ label }: FlagLetterProps) => {
  return <div className={styles.flagLetter}>{label}</div>;
});

export type BitValueProps = {
  value?: boolean | number;
  tooltip?: string;
  clicked?: () => void;
};

export const BitValue = ({ value, tooltip, clicked }: BitValueProps) => {
  const ref = useTooltipRef();

  const iconName = useMemo(() => {
    if (value === undefined || value === null) return "close";
    return value ? "circle-filled" : "circle-outline";
  }, [value]);

  return (
    <div
      ref={ref}
      className={classnames(styles.flag, styles.clickable)}
      onClick={() => clicked?.()}
    >
      <div className={styles.flagValue}>
        <Icon iconName={iconName} width={16} height={16} fill="--color-value" />
      </div>
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="bottom"
          offsetX={0}
          offsetY={16}
          showDelay={100}
          content={tooltip}
        />
      )}
    </div>
  );
};

type FlagFieldRowProps = {
  label: string;
  tooltip: string;
  value: number;
  flagDescriptions: string[];
};

const LAB_WIDTH = 48;

export const FlagFieldRow = ({ label, tooltip, value, flagDescriptions }: FlagFieldRowProps) => {
  return (
    <Col>
      <Label text={label} width={LAB_WIDTH} tooltip={tooltip} />
      <FlagRow value={value} flagDescriptions={flagDescriptions} />
    </Col>
  );
};

