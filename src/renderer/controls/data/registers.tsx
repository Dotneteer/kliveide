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
  /**
   * Extra class merged onto the value cell.
   *
   * Lets one panel opt into `--color-state-value` (see the comment over that token in
   * componentAliases.ts) without recolouring the other panels that share this component — omit it
   * and the cell stays the neutral `--data-value` it always was.
   */
  valueXclass?: string;
};

export const Bit16Value = memo(
  ({ label, tooltip, reg16Label, reg8LLabel, reg8HLabel, value, valueXclass }: Props) => {
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
        <DataValue text={displayValue} xclass={classnames(styles.regValue, valueXclass)} />
      </DataRow>
    );
  }
);

type Bit8Props = {
  label: string;
  value: number;
  tooltip?: string;
  /** See `Props.valueXclass` above. */
  valueXclass?: string;
};

export const Bit8Value = memo(({ label, tooltip, value, valueXclass }: Bit8Props) => {
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
      <DataValue text={displayValue} xclass={classnames(styles.regValue, valueXclass)} />
    </DataRow>
  );
});

type SimpleProps = {
  label: string;
  value: number | string;
  tooltip?: string;
  fullWidth?: boolean;
  /** See `Props.valueXclass` above. */
  valueXclass?: string;
};

export const SimpleValue = memo(
  ({ label, tooltip, value, fullWidth = false, valueXclass }: SimpleProps) => {
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
        <DataValue
          text={displayValue}
          xclass={classnames(fullWidth ? styles.regValueAuto : styles.regValue, valueXclass)}
        />
      </DataRow>
    );
  }
);

type FlagProps = {
  label: string;
  value?: boolean | null;
  tooltip?: string;
  /**
   * The theme property the dot icon is filled with. Defaults to the neutral `--data-value`, the
   * same as every other consumer of `FlagValue`/`VerticalFlagValue`; a panel passes
   * `--color-state-value` (see componentAliases.ts) to opt in.
   */
  iconFill?: string;
};

const flagIcon = (value?: boolean | number | null) => {
  if (value === undefined || value === null) return "close";
  return value ? "circle-filled" : "circle-outline";
};

export const FlagValue = memo(({ label, tooltip, value, iconFill }: FlagProps) => {
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
        <div className={styles.flagDot}>
          <Icon iconName={iconName} width={16} height={16} fill={iconFill ?? "--data-value"} />
        </div>
      </div>
    </DataRow>
  );
});

export const VerticalFlagValue = memo(({ label, tooltip, value, iconFill }: FlagProps) => {
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
      <div className={styles.verticalFlagValue}>
        <Icon iconName={iconName} width={16} height={16} fill={iconFill ?? "--data-value"} />
      </div>
    </div>
  );
});

type FlagLetterProps = {
  label: string;
};

export const FlagLetter = memo(({ label }: FlagLetterProps) => {
  return (
    <div className={styles.flagLetter}>
      <span className={styles.flagLetterGlyph}>{label}</span>
    </div>
  );
});

export type BitValueProps = {
  value?: boolean | number;
  tooltip?: string;
  clicked?: () => void;
  /** See `FlagProps.iconFill` above. */
  iconFill?: string;
  /**
   * Extra class merged onto the bit cell, for a caller that needs its strip on a particular column
   * grid. The default cell sizes to the icon; `UlaPanel` widens it so its keyboard bits sit on the
   * same character grid as the value column above them.
   */
  xclass?: string;
  /**
   * Reports the pointer entering and leaving the bit, for a caller that renders the hovered bit's
   * description in a tooltip of its own (see `FlagRow`'s `onHoverBit`). On the cell rather than a
   * wrapper element, because `.flagStrip` is a flex row and an extra div in it is an extra flex
   * item.
   */
  onHover?: (hovered: boolean) => void;
};

export const BitValue = ({ value, tooltip, clicked, iconFill, xclass, onHover }: BitValueProps) => {
  const ref = useTooltipRef<HTMLDivElement>();
  const iconName = useMemo(() => flagIcon(value), [value]);

  return (
    <div
      ref={ref}
      className={classnames(styles.bitValue, xclass, { [styles.clickable]: !!clicked })}
      onClick={() => clicked?.()}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
    >
      <div className={styles.flagValue}>
        <Icon iconName={iconName} width={16} height={16} fill={iconFill ?? "--data-value"} />
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
  /** See `FlagProps.iconFill`. A converted panel passes `--color-state-value`. */
  iconFill?: string;
  /** Extra class merged onto the strip, for a caller that needs it on a particular column grid. */
  xclass?: string;
  /**
   * The bit under the pointer, or `null` when it leaves the strip.
   *
   * **Passing this suppresses the per-bit tooltips**, and that is the point rather than a side
   * effect. A strip inside a row whose *row* carries a `TooltipFactory` otherwise shows two tooltip
   * boxes for one pointer — the bit's and the row's — so a caller that wants a single tooltip has
   * to be able to take the content over. It then renders the hovered bit itself, the way
   * `MemoryDumpSection` renders its hovered byte. Twin of `HexByteGrid`'s `onHoverByte`.
   */
  onHoverBit?: (bit: number | null) => void;
};

/** An eight-bit flag strip for register and memory state displays. */
export const FlagRow = ({
  value,
  flagDescriptions,
  iconFill,
  xclass,
  onHoverBit
}: FlagRowProps) => (
  <div
    className={classnames(styles.flagStrip, xclass)}
    onMouseLeave={onHoverBit ? () => onHoverBit(null) : undefined}
  >
    {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => (
      <BitValue
        key={bit}
        value={value & (1 << bit)}
        iconFill={iconFill}
        tooltip={onHoverBit ? undefined : `Bit ${bit}: ${flagDescriptions?.[bit] ?? ""}`}
        onHover={onHoverBit ? (hovered) => onHoverBit(hovered ? bit : null) : undefined}
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
