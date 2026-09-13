import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { DataLabel } from "@renderer/controls/data";
import classnames from "classnames";
import styles from "./Layout.module.scss";

type Props = {
  /** Label text rendered in the aligned cell. */
  text: string;
  /**
   * Explicit label cell width, as a CSS length **with its unit** — `"7ch"` for a column, `"32px"`
   * for chrome. The bare-number form was removed in Phase 15: it meant px here and `ch` in
   * `controls/data`, and all three of these cells documented it as `ch`, which is how
   * `NecUpd765Panel` acquired a 16px column from an author who read the prop.
   */
  width?: string;
  /** Centers label text within the cell when true. */
  center?: boolean;
  /** Optional tooltip shown for the label cell. */
  tooltip?: string;
  /**
   * Extra class merged onto the cell, for a caller that wants its own restyled label text (e.g.
   * the disassembly view's jump-target label column) without touching every other consumer of
   * this shared component.
   */
  className?: string;
};

/**
 * Provides fixed-width label text for aligned key-value rows.
 *
 * The cell itself is `controls/data`'s `DataLabel`; this wrapper adds only the `TooltipFactory`
 * behaviour and the legacy inline spacing. Klive had three separate `.label`/`.value`
 * implementations — here, in `controls/valuedisplay`, and in `controls/data` — and this is the one
 * with 21 importers, so it delegates rather than being rewritten at every call site.
 */
export const Label = ({ text, width, center, tooltip, className }: Props) => {
  const ref = useTooltipRef();

  return (
    <>
      <DataLabel
        ref={ref}
        text={text}
        width={width}
        xclass={classnames(styles.legacySpacing, { [styles.centered]: center }, className)}
      />
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
    </>
  );
};
