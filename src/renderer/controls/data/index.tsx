import type { CSSProperties, ReactNode } from "react";
import classnames from "classnames";
import styles from "./Data.module.scss";

/**
 * `controls/data` — the shared primitives for Klive's data-dense panels.
 *
 * Phase 6 of .plans/UI_MODERNIZATION_PLAN.md. Before this, `SiteBarPanels/` and `DocumentPanels/`
 * each hand-rolled the same handful of shapes: 7 of 12 sidebar stylesheets carried a byte-identical
 * root block, six carried a byte-identical empty state, and 16 files across the two folders defined
 * their own "data row".
 *
 * The API is deliberately small. Anything a panel needs that is not here is a signal that the
 * primitive set is wrong, not that the panel is special.
 */

// ---------------------------------------------------------------------------------------------
// Panel shell
// ---------------------------------------------------------------------------------------------

type DataPanelProps = {
  children?: ReactNode;
  /** Extra class for panel-specific layout. Should be rare. */
  xclass?: string;
  style?: CSSProperties;
};

/**
 * The root of a data panel: fills its parent, monospace, tokenized type, and **selectable text**.
 */
export const DataPanel = ({ children, xclass, style }: DataPanelProps) => (
  <div className={classnames(styles.dataPanel, xclass)} style={style}>
    {children}
  </div>
);

/** Chrome inside a data panel — a header or toolbar row — which should not be selectable. */
export const DataChrome = ({ children, xclass }: DataPanelProps) => (
  <div className={classnames(styles.noSelect, xclass)}>{children}</div>
);

// ---------------------------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------------------------

type EmptyStateProps = {
  /** Sentence describing what would appear here. No trailing space — two of the originals had one. */
  message: string;
  /** The Sinclair rainbow flash. On by default; opt out where it would be noise. */
  motif?: boolean;
};

/**
 * The Spectrum's four bright flash colours.
 *
 * Values are the machine's own, converted from the ABGR entries in
 * `emu/machines/CommonScreenDevice.ts` — bright red, yellow, green and cyan — rather than invented.
 *
 * NOTE: the *order* here is from memory of the case flash and could not be confirmed from a
 * documentary source; it needs a second pair of eyes.
 */
const RAINBOW = ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF"];

/**
 * Shown when a panel has nothing to display.
 *
 * Replaces six byte-identical `.center` blocks and five separately-written messages. It also renders
 * in `--data-secondary` rather than reaching for `--console-ansi-*`, which is what made the old
 * empty states green.
 */
export const EmptyState = ({ message, motif = true }: EmptyStateProps) => (
  <div className={styles.emptyState}>
    {motif && (
      <div className={styles.rainbow} aria-hidden="true">
        {RAINBOW.map((colour) => (
          <span key={colour} className={styles.rainbowStripe} style={{ background: colour }} />
        ))}
      </div>
    )}
    <span>{message}</span>
  </div>
);

// ---------------------------------------------------------------------------------------------
// Panel header
// ---------------------------------------------------------------------------------------------

type PanelHeaderProps = {
  /** Rendered uppercase at the left. Omit for a header that is purely a toolbar. */
  title?: string;
  /** Controls. Anything after a `<PanelHeaderActions>` child is pushed to the right edge. */
  children?: ReactNode;
  xclass?: string;
};

/**
 * A data panel's header: title on the left, actions after it.
 *
 * Replaces 17 hand-rolled `<div className={styles.header}>` blocks across 13 files, which ran at
 * three different heights. The one shared helper that existed — `DocumentPanels/helpers/PanelHeader`
 * — was twelve lines of `HStack` with hardcoded 4px/2px padding and no title, actions, surface or
 * border, so most panels understandably rolled their own instead.
 */
export const PanelHeader = ({ title, children, xclass }: PanelHeaderProps) => (
  <div className={classnames(styles.panelHeader, xclass)}>
    {title && <span className={styles.panelTitle}>{title}</span>}
    {children}
  </div>
);

/** Right-aligned group inside a `PanelHeader`. */
export const PanelHeaderActions = ({ children }: { children?: ReactNode }) => (
  <div className={styles.panelHeaderActions}>{children}</div>
);

// ---------------------------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------------------------

type DataRowProps = {
  children?: ReactNode;
  /** Zebra striping. Pass the row index; the primitive decides. */
  index?: number;
  hoverable?: boolean;
  clicked?: () => void;
  xclass?: string;
  style?: CSSProperties;
};

/**
 * One row of tabular data.
 *
 * Zebra striping used to exist in three forms at once — inline `backgroundColor` props on `HStack`,
 * a rule in `DisassemblyPanel.module.scss`, and another in `StaticMemoryView.module.scss`. This is
 * the one implementation.
 */
export const DataRow = ({ children, index, hoverable, clicked, xclass, style }: DataRowProps) => (
  <div
    className={classnames(styles.dataRow, xclass, {
      [styles.even]: index !== undefined && index % 2 === 0,
      [styles.hoverable]: hoverable ?? !!clicked,
      [styles.clickable]: !!clicked
    })}
    style={style}
    onClick={clicked}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------

type CellProps = {
  text: string;
  /** Width in `ch`, so columns survive a font or size change (M2). */
  width?: number;
  /** Highlights a value that moved since the last stop. */
  changed?: boolean;
  title?: string;
  xclass?: string;
};

const cellStyle = (width?: number): CSSProperties | undefined =>
  width === undefined ? undefined : { width: `${width}ch` };

/** A field name. Recedes: `--data-label`. */
export const DataLabel = ({ text, width, title, xclass }: CellProps) => (
  <span className={classnames(styles.dataLabel, xclass)} style={cellStyle(width)} title={title}>
    {text}
  </span>
);

/** The datum itself. The most legible thing in the row: `--data-value`. */
export const DataValue = ({ text, width, changed, title, xclass }: CellProps) => (
  <span
    className={classnames(styles.dataValue, xclass, { [styles.changed]: changed })}
    style={cellStyle(width)}
    title={title}
  >
    {text}
  </span>
);

/** An annotation beside a value — a decimal echo, a unit. */
export const DataSecondary = ({ text, width, title, xclass }: CellProps) => (
  <span className={classnames(styles.dataSecondary, xclass)} style={cellStyle(width)} title={title}>
    {text}
  </span>
);

// ---------------------------------------------------------------------------------------------
// Hex
// ---------------------------------------------------------------------------------------------

type HexValueProps = {
  value: number;
  /** Hex digits: 2 for a byte, 4 for a word. */
  digits?: 2 | 4 | 6 | 8;
  /** Show the decimal in parentheses beside the hex. */
  decimal?: boolean;
  /** `$` by default. Slice 6.4 settles whether every panel should carry it. */
  prefix?: string;
  changed?: boolean;
  title?: string;
};

/**
 * A hexadecimal value.
 *
 * "Labeled hex value" had six independent implementations, and the formatting was forked with them:
 * `WatchPanel.tsx:177` produced uppercase and `:226` lowercase forty lines apart, and the `$` prefix
 * was present in some panels and absent in others. This is the single formatter; uppercase, because
 * that is what the majority already produced.
 */
export const HexValue = ({
  value,
  digits = 2,
  decimal,
  prefix = "$",
  changed,
  title
}: HexValueProps) => {
  const hex = (value >>> 0).toString(16).toUpperCase().padStart(digits, "0");
  return (
    <>
      <DataValue text={`${prefix}${hex}`} changed={changed} title={title} />
      {decimal && <DataSecondary text={`(${value})`} />}
    </>
  );
};
