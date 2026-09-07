import { toBin16, toBin8, toHexa4, toHexa2 } from "@renderer/appIde/services/ide-commands";
import { TooltipFactory, useTooltipRef } from "../Tooltip";
import { Icon } from "../Icon";
import { DataLabel, DataRow, DataValue } from "./index";
import styles from "./Registers.module.scss";
import { useMemo, memo } from "react";
import classnames from "classnames";

/**
 * Register and CPU-state displays.
 *
 * Moved here from `controls/valuedisplay` in slice 6.6. The components are unchanged in behaviour;
 * what changed is that their row, label and value now come from `controls/data` instead of from a
 * third private copy of the same three shapes.
 *
 * Every row is a `dense` `DataRow`: the shared `--measure-gap` between cells, and none of the list
 * chrome. That gap is also the fix for the `fullWidth` defect, where an auto-width value used to
 * butt straight into the next label and render `CON 0LCO 0` in the ULA panel.
 */

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
    const ref = useTooltipRef<HTMLDivElement>();

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
      <DataRow ref={ref} dense>
        <DataLabel text={label} xclass={styles.regLabel} />
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
        <DataValue text={displayValue} xclass={styles.regValue} />
      </DataRow>
    );
  }
);

type Bit8Props = {
  label: string;
  value: number;
  tooltip?: string;
};

export const Bit8Value = memo(({ label, tooltip, value }: Bit8Props) => {
  const ref = useTooltipRef<HTMLDivElement>();

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
    <DataRow ref={ref} dense>
      <DataLabel text={label} xclass={styles.regLabel} />
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
      <DataValue text={displayValue} xclass={styles.regValue} />
    </DataRow>
  );
});

type SimpleProps = {
  label: string;
  value: number | string;
  tooltip?: string;
  fullWidth?: boolean;
};

export const SimpleValue = memo(({ label, tooltip, value, fullWidth = false }: SimpleProps) => {
  const ref = useTooltipRef<HTMLDivElement>();

  const displayValue = useMemo(() => {
    return value !== undefined ? value.toString() : "--";
  }, [value]);

  return (
    <DataRow ref={ref} dense>
      <DataLabel text={label} xclass={styles.regLabel} />
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
      <DataValue text={displayValue} xclass={fullWidth ? styles.regValueAuto : styles.regValue} />
    </DataRow>
  );
});

type FlagProps = {
  label: string;
  value?: boolean | null;
  tooltip?: string;
};

const flagIcon = (value?: boolean | number | null) => {
  if (value === undefined || value === null) return "close";
  return value ? "circle-filled" : "circle-outline";
};

export const FlagValue = memo(({ label, tooltip, value }: FlagProps) => {
  const ref = useTooltipRef<HTMLDivElement>();
  const iconName = useMemo(() => flagIcon(value), [value]);

  return (
    <DataRow ref={ref} dense>
      <DataLabel text={label} xclass={styles.regLabel} />
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
      <div className={classnames(styles.flagValue, styles.regValue)}>
        <Icon iconName={iconName} width={16} height={16} fill="--data-value" />
      </div>
    </DataRow>
  );
});

export const VerticalFlagValue = memo(({ label, tooltip, value }: FlagProps) => {
  const ref = useTooltipRef<HTMLDivElement>();
  const iconName = useMemo(() => flagIcon(value), [value]);

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
        <Icon iconName={iconName} width={16} height={16} fill="--data-value" />
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
  const ref = useTooltipRef<HTMLDivElement>();
  const iconName = useMemo(() => flagIcon(value), [value]);

  return (
    <div
      ref={ref}
      className={classnames(styles.bitValue, { [styles.clickable]: !!clicked })}
      onClick={() => clicked?.()}
    >
      <div className={styles.flagValue}>
        <Icon iconName={iconName} width={16} height={16} fill="--data-value" />
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

type FlagRowProps = {
  /** Bit descriptions shown in per-flag tooltips, indexed from bit 0 to bit 7. */
  flagDescriptions: string[];
  /** Byte value rendered as eight individual bit indicators. */
  value: number;
};

/** An eight-bit flag strip for register and memory state displays. */
export const FlagRow = ({ value, flagDescriptions }: FlagRowProps) => (
  <div className={styles.flagStrip}>
    {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => (
      <BitValue
        key={bit}
        value={value & (1 << bit)}
        tooltip={`Bit ${bit}: ${flagDescriptions?.[bit] ?? ""}`}
      />
    ))}
  </div>
);

type FlagFieldRowProps = {
  label: string;
  tooltip: string;
  value: number;
  flagDescriptions: string[];
};

export const FlagFieldRow = ({ label, tooltip, value, flagDescriptions }: FlagFieldRowProps) => {
  const ref = useTooltipRef<HTMLDivElement>();

  return (
    <DataRow ref={ref} dense>
      <DataLabel text={label} xclass={styles.regLabel} />
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
      <FlagRow value={value} flagDescriptions={flagDescriptions} />
    </DataRow>
  );
};
