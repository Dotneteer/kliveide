import type { CSSProperties, ReactNode } from "react";
import { forwardRef } from "react";
import classnames from "classnames";
import { toBin8 } from "@renderer/appIde/services/ide-commands";
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
  /**
   * Size to content instead of filling the parent.
   *
   * Set this whenever the panel's registry entry leaves `useScrollViewer` at its default, because
   * then the host wraps the panel in a `ScrollViewer` and a panel pinned to `height: 100%` hides its
   * own overflow before the viewer can scroll it.
   */
  autoHeight?: boolean;
  /** Extra class for panel-specific layout. Should be rare. */
  xclass?: string;
  style?: CSSProperties;
};

/**
 * The root of a data panel: fills its parent, monospace, tokenized type, and **selectable text**.
 */
export const DataPanel = ({ children, autoHeight, xclass, style }: DataPanelProps) => (
  <div
    className={classnames(styles.dataPanel, xclass, { [styles.autoHeight]: autoHeight })}
    style={style}
  >
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
 * The order — red, yellow, green, cyan — was confirmed by the project author.
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

/**
 * A heading *within* panel content — a disk track, a sector, a memory bank.
 *
 * Not a `PanelHeader`: that is a panel's own chrome, with a chrome surface and a bottom border.
 * `DskViewerPanel` used one class for both roles, which is why its nested headings looked like
 * strips of chrome dropped into the middle of a listing.
 */
export const SectionHeader = ({
  title,
  children,
  clicked,
  xclass
}: PanelHeaderProps & { clicked?: () => void }) => (
  <div
    className={classnames(styles.sectionHeader, xclass, {
      [styles.sectionHeaderClickable]: !!clicked
    })}
    onClick={clicked}
  >
    {title && <span>{title}</span>}
    {children}
  </div>
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
  /**
   * A field row inside a register/state panel: the shared gap, none of the list chrome.
   *
   * The register panels draw 15px rows of label/value pairs. They are not list rows -- no striping,
   * no hover, no click -- and giving them the 22px `--row-size-list` and the 8px side padding would
   * have made the Z80 panel 47% taller. Slice 6.6 found this the way slice 6.0 found `HexByteGrid`:
   * a panel that would not migrate cleanly means the primitive set is incomplete, not that the panel
   * is special.
   */
  dense?: boolean;
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
export const DataRow = forwardRef<HTMLDivElement, DataRowProps>(
  ({ children, index, hoverable, clicked, dense, xclass, style }, ref) => (
    <div
      ref={ref}
      className={classnames(styles.dataRow, xclass, {
        [styles.dense]: dense,
        [styles.even]: index !== undefined && index % 2 === 0,
        [styles.hoverable]: hoverable ?? !!clicked,
        [styles.clickable]: !!clicked
      })}
      style={style}
      onClick={clicked}
    >
      {children}
    </div>
  )
);
DataRow.displayName = "DataRow";

// ---------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------

type CellProps = {
  text: string;
  /**
   * Width in `ch`, so columns survive a font or size change (M2).
   *
   * A string is passed through as a CSS length. Prefer sizing from a stylesheet via `xclass` —
   * moving column widths out of React props and into CSS is the point of the measure scale — but
   * the string form is what lets the `controls/layout` wrappers, whose `width` prop 21 files
   * already pass, delegate here without changing their API.
   */
  width?: number | string;
  /** Highlights a value that moved since the last stop. */
  changed?: boolean;
  title?: string;
  xclass?: string;
};

const cellStyle = (width?: number | string): CSSProperties | undefined =>
  width === undefined ? undefined : { width: typeof width === "number" ? `${width}ch` : width };

/*
 * The three cells forward their ref.
 *
 * That is what lets `controls/layout`'s `Label`/`Value`/`Secondary` keep their richer
 * `TooltipFactory` API -- which 21 files import -- while delegating the actual cell to these
 * primitives. Without it, the tooltip would need a wrapper element and the layout would change, and
 * the alternative -- pulling `TooltipFactory` down into `controls/data` -- would put a hook on all
 * 187 cells to serve the handful that show a tooltip.
 */

/** A field name. Recedes: `--data-label`. */
export const DataLabel = forwardRef<HTMLSpanElement, CellProps>(
  ({ text, width, title, xclass }, ref) => (
    <span
      ref={ref}
      className={classnames(styles.dataLabel, xclass)}
      style={cellStyle(width)}
      title={title}
    >
      {text}
    </span>
  )
);
DataLabel.displayName = "DataLabel";

/** The datum itself. The most legible thing in the row: `--data-value`. */
export const DataValue = forwardRef<HTMLSpanElement, CellProps>(
  ({ text, width, changed, title, xclass }, ref) => (
    <span
      ref={ref}
      className={classnames(styles.dataValue, xclass, { [styles.changed]: changed })}
      style={cellStyle(width)}
      title={title}
    >
      {text}
    </span>
  )
);
DataValue.displayName = "DataValue";

/** An annotation beside a value — a decimal echo, a unit. */
export const DataSecondary = forwardRef<HTMLSpanElement, CellProps>(
  ({ text, width, title, xclass }, ref) => (
    <span
      ref={ref}
      className={classnames(styles.dataSecondary, xclass)}
      style={cellStyle(width)}
      title={title}
    >
      {text}
    </span>
  )
);
DataSecondary.displayName = "DataSecondary";

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
  prefix = HEX_PREFIX,
  changed,
  title
}: HexValueProps) => (
  <>
    <DataValue text={formatHex(value, digits, prefix)} changed={changed} title={title} />
    {decimal && <DataSecondary text={`(${value})`} />}
  </>
);

/**
 * The hex prefix used throughout the UI.
 *
 * `$` matches what the panels overwhelmingly already showed, and there is no disagreement with the
 * assembler to resolve: Klive's Z80 dialect accepts **both** prefixes. `common-token-stream.ts`
 * lexes `#` (guarded by `supportsHashedHexadecimal`, on by default) and `$` alike, so `.org #7C00`
 * and `.org $7C00` are the same program. The UI settling on one of the two is a display choice, not
 * an inconsistency.
 */
export const HEX_PREFIX = "$";

/**
 * The single hex formatter.
 *
 * Exported as a function, not only as a component, because several call sites need the string
 * outside JSX — `WatchPanel` builds tooltip text and array previews this way, and had drifted into
 * producing **uppercase on one line and lowercase forty lines later** in the same file.
 *
 * Uppercase, because that is what the shared `toHexa2`/`toHexa4` helpers have always produced.
 */
export function formatHex(value: number, digits = 2, prefix = HEX_PREFIX): string {
  return `${prefix}${(value >>> 0).toString(16).toUpperCase().padStart(digits, "0")}`;
}

/**
 * A tooltip for a byte, in the memory dump's format: a heading, then hex with the decimal and
 * binary in parentheses — `$08 (8, %0000 1000)`.
 *
 * The same line `buildByteTooltipCache` builds in `features/memory/MemoryDumpSection.tsx`. Shared
 * from here rather than copied per panel, because "what does this byte say in decimal and binary"
 * is the same question in every data panel and had already been answered three different ways.
 */
export function byteTooltip(heading: string, value: number): string {
  return `${heading}\n${formatHex(value, 2)} (${value}, ${toBin8(value)})`;
}

// ---------------------------------------------------------------------------------------------
// Address gutter
// ---------------------------------------------------------------------------------------------

/**
 * The `bank:` prefix in front of an address.
 *
 * Widths are `ch` (M2): a partition label is two or three characters, so the column is exactly that
 * wide whatever the font does.
 */
export const PartitionPrefix = ({ label, wide }: { label: string; wide?: boolean }) => (
  <div className={styles.partitionPrefix}>
    <span className={styles.partitionLabel} style={{ width: wide ? "3ch" : "2ch" }}>
      {label}
    </span>
    <span className={styles.partitionColon}>:</span>
  </div>
);

/**
 * The address at the head of a data row.
 *
 * `width` is in `ch`, so the column holds a fixed number of digits rather than a pixel count tuned
 * to one font — the disassembly and memory rows previously passed 40, 48, 64 and 72 px between them.
 *
 * `className` lets one caller restyle its own addresses (the memory dump, for its accent-tinted
 * gutter) without touching every other consumer of this shared component (disassembly rows).
 */
export const AddressLabel = ({
  text,
  width,
  className
}: {
  text: string;
  width: number;
  className?: string;
}) => (
  <div className={classnames(styles.addressLabel, className)} style={{ width: `${width}ch` }}>
    {text}
  </div>
);

// ---------------------------------------------------------------------------------------------
// Hex byte grid
// ---------------------------------------------------------------------------------------------

type HexByteGridProps = {
  bytes: Uint8Array | number[];
  /** Bytes per row. */
  stride?: number;
  /** Tooltip for byte `i`, if the caller has one. */
  titleFor?: (index: number) => string | undefined;
};

/**
 * A wrapped grid of hex bytes.
 *
 * The gap slice 6.0 found: every other part of `SysVarsPanel` migrated cleanly, but its array dump
 * kept three private rules because the primitive set had nothing for a byte grid.
 */
export const HexByteGrid = ({ bytes, stride = 8, titleFor }: HexByteGridProps) => {
  const rows: number[][] = [];
  for (let i = 0; i < bytes.length; i += stride) {
    rows.push(Array.from(bytes.slice(i, i + stride) as ArrayLike<number>));
  }
  return (
    <div className={styles.hexByteGrid}>
      {rows.map((row, r) => (
        <div key={r} className={styles.hexByteRow}>
          {row.map((b, c) => {
            const index = r * stride + c;
            return (
              <span key={index} className={styles.hexByte} title={titleFor?.(index)}>
                {formatHex(b, 2, "")}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
