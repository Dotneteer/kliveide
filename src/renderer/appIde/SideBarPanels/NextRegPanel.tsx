import { Label } from "@renderer/controls/layout/Label";
import { Secondary } from "@renderer/controls/layout/Secondary";
import { Value } from "@renderer/controls/layout/Value";
import { useCallback, useState } from "react";
import { toBin8, toHexa2 } from "../services/ide-commands";
import styles from "./NextRegPanel.module.scss";
import {} from "@controls/Tooltip";
import { NextRegValueSlice, RegValueState } from "@emu/machines/zxNext/nextRegDescriptors";
import { isFlagSlice, sliceBits, sliceText, sliceValue } from "@common/zxnext/nextRegSlices";
import { useNextRegDescriptors, useNextRegState } from "@renderer/features/nextRegs/useNextRegState";
import { SmallIconButton } from "@controls/IconButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import type { SideBarPanelBadgeProps } from "@renderer/abstractions/SideBarPanelInfo";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { DataRow } from "@renderer/controls/data";
import { Icon } from "@renderer/controls/Icon";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import classnames from "classnames";
import { HistoryPresentBanner } from "../debugger/history/HistoryPresentBanner";
import { useT, type TFunction } from "@common/i18n/useT";

// M2: `ch`, not px. Capacity preserved from the px width at its old 12.8px size (px / 6.4).
const VALUE_WIDTH = "5ch"; // 32px / 6.4

/**
 * The previous-value arrow.
 *
 * `→` (U+2192), not an emoji arrow (`➡️`): an emoji-presentation codepoint renders from the colour
 * emoji font, which is proportional and would break this panel's `ch` grid, and a colour glyph in a
 * monochrome hex dump reads as decoration rather than as notation. Iosevka carries U+2192 at the
 * same 0.5em advance as every other glyph, and the cell is trailing-aligned so a fallback font's
 * arrow cannot shift the column either.
 */
const WROTE_ARROW = "→";

/**
 * A byte tooltip in the memory dump's format: hex, then decimal and binary in parentheses
 * (`buildByteTooltipCache` in `features/memory/MemoryDumpSection.tsx` builds the same
 * `$08 (8, 00001000)` line), under a heading naming which of the two values it describes.
 *
 * The headings say "Last written" and "Current value" rather than "old" and "new" because that is
 * literally what `RegValueState` carries — `lastWrite` is the last byte written to the register and
 * `value` is what it reads back, which for the asymmetric Next registers are not the same thing.
 */
const valueTooltip = (heading: string, value: number) =>
  `${heading}\n$${toHexa2(value)} (${value}, ${toBin8(value)})`;

/**
 * The whole register row, in one tooltip.
 *
 * The row used to bind three — one on the label carrying the description, one on the "last written"
 * cell and one on the value — so a pointer crossing the row raised up to three boxes for one thing
 * the reader thinks of as a single register. `MemMappingPanel`'s `TipRow` settled this pattern in
 * the same folder; this is the same idea with the row's several numbers folded into the content.
 */
const registerTooltip = (
  t: TFunction,
  id: number,
  description: string | undefined,
  value: number | undefined,
  lastWrite: number | undefined
) =>
  [
    `Reg $${toHexa2(id)}${description ? ` — ${description}` : ""}`,
    value !== undefined ? valueTooltip(t("panels.side.nextReg.currentValue"), value) : undefined,
    lastWrite !== undefined ? valueTooltip(t("panels.side.nextReg.lastWritten"), lastWrite) : undefined
  ]
    .filter(Boolean)
    .join("\n\n");

// ---------------------------------------------------------------------------------------------
// Decoding a register's `slices`
// ---------------------------------------------------------------------------------------------

/*
 * `NextRegDevice` documents 73 of its 141 registers field by field — 338 slices in all, 292 of them
 * single bits, 46 multi-bit fields and 21 carrying a named `valueSet`. All of it already travels to
 * the renderer inside `NextRegDescriptor`. The slice helpers live in `@common/zxnext/nextRegSlices`,
 * shared with the Copper decoder, whose MOVE meanings are the same slice text.
 */

/**
 * One decoded field of a register.
 *
 * A flag's value is drawn as the same filled/outline circle the Z80, ULA, VIC and Blink panels use
 * for their flags (`flagIcon` in `controls/data/registers.tsx`) rather than as the words "on"/"off":
 * a column of circles can be read down at a glance, where a column of words has to be read word by
 * word. Multi-bit fields keep their hex, because a number is what they are.
 */
const SliceRow = ({ slice, regValue }: { slice: NextRegValueSlice; regValue: number }) => {
  const t = useT();
  const ref = useTooltipRef<HTMLDivElement>();
  const value = sliceValue(regValue, slice);
  const flag = isFlagSlice(slice);
  const text = sliceText(regValue, slice);

  return (
    <div ref={ref} className={styles.sliceRow}>
      <span className={styles.sliceBits}>{sliceBits(slice)}</span>
      <span className={styles.sliceValue}>
        {flag ? (
          <Icon
            iconName={value ? "circle-filled" : "circle-outline"}
            width={16}
            height={16}
            fill="--color-state-value"
          />
        ) : (
          `$${toHexa2(value)}`
        )}
      </span>
      <span className={styles.sliceText}>{text}</span>
      {text && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={0}
          offsetY={0}
          showDelay={100}
          content={`${t(sliceBits(slice).includes(":") ? "panels.side.nextReg.bits" : "panels.side.nextReg.bit", {
            bits: sliceBits(slice)
          })}\n${text}\n${
            flag
              ? t(value ? "panels.side.nextReg.bitSet" : "panels.side.nextReg.bitClear")
              : `$${toHexa2(value)} (${value})`
          }`}
        />
      )}
    </div>
  );
};

/**
 * One register row, with **one** tooltip.
 *
 * Extracted from the list's `renderItem` because binding a tooltip needs `useTooltipRef`, and a
 * hook cannot be called from a render prop that runs conditionally. Same shape and same reason as
 * `MemMappingPanel`'s `TipRow`.
 */
type NextRegRowProps = {
  item: RegValueState;
  description?: string;
  hasDetail: boolean;
  isExpanded: boolean;
  onToggle: () => void;
};

const NextRegRow = ({ item, description, hasDetail, isExpanded, onToggle }: NextRegRowProps) => {
  const t = useT();
  const ref = useTooltipRef<HTMLDivElement>();

  return (
    <DataRow
      hoverable
      dense
      xclass={styles.nextRegRow}
      ref={ref}
      clicked={hasDetail ? onToggle : undefined}
    >
      {/*
        * The expander gutter is always rendered, even for the 67 registers that carry no slices, so
        * their labels stay on the same column as the ones that do. An empty box costs a column; a
        * missing box costs a ragged panel.
        */}
      <span className={styles.nextRegChevron}>
        {hasDetail && (
          <Icon
            iconName={isExpanded ? "chevron-down" : "chevron-right"}
            width={16}
            height={16}
            fill="--color-chevron"
          />
        )}
      </span>
      <Label text={`Reg ${toHexa2(item.id)}:`} className={styles.nextRegLabel} />
      {item.lastWrite !== undefined && (
        <Secondary
          text={`${toHexa2(item.lastWrite)} ${WROTE_ARROW}`}
          className={classnames(styles.nextRegWrite, regStyles.stateValueAlt)}
        />
      )}
      {item.value !== undefined && (
        <Value
          text={`${toHexa2(item.value)}`}
          width={VALUE_WIDTH}
          className={regStyles.stateValue}
        />
      )}
      <TooltipFactory
        refElement={ref.current}
        placement="right"
        offsetX={0}
        offsetY={0}
        showDelay={100}
        content={registerTooltip(t, item.id, description, item.value, item.lastWrite)}
      />
    </DataRow>
  );
};

export const NextRegPanel = () => {
  const t = useT();
  /*
   * The descriptors and the state come from the hooks the Next Registers document reads too
   * (`features/nextRegs/useNextRegState`): the descriptor table is cached per machine there, and
   * the state refreshes with the machine.
   */
  const descriptors = useNextRegDescriptors();
  const { lastRegisterIndex: lastRegIndex, regs: regVals } = useNextRegState();
  /*
   * Which registers are expanded, held *here* rather than inside the row.
   *
   * `VirtualizedList` mounts only the visible rows and recycles them as you scroll, so per-row state
   * would be discarded the moment a register scrolled out of view and silently reappear collapsed.
   * A set in the panel outlives that.
   */
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());

  const toggleExpanded = useCallback((id: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  return (
    <div className={styles.nextRegPanel}>
      <HistoryPresentBanner subject="nextRegisters" />
      <DataRow hoverable dense xclass={styles.nextRegRow}>
        <Label text={t("panels.side.nextReg.lastRegIndexLabel")} className={styles.nextRegHeaderLabel} />
        <Value
          text={toHexa2(lastRegIndex ?? 0)}
          className={regStyles.stateValue}
          tooltip={valueTooltip(t("panels.side.nextReg.lastRegIndex"), lastRegIndex ?? 0)}
        />
      </DataRow>
      <VirtualizedList
        items={regVals ?? []}
        renderItem={(idx) => {
          // --- `virtua` can render an index measured against a longer list than the one it is
          // --- handed a tick later; every other virtualized panel here guards the same way.
          const item = regVals?.[idx];
          if (!item) return null;
          const slices = descriptors?.[item.id]?.slices;
          const hasDetail = !!slices?.length;
          const isExpanded = hasDetail && expanded.has(item.id);
          return (
            <>
            <NextRegRow
              item={item}
              description={descriptors?.[item.id]?.description}
              hasDetail={hasDetail}
              isExpanded={isExpanded}
              onToggle={() => toggleExpanded(item.id)}
            />
            {isExpanded && (
              <div className={styles.sliceDetail}>
                {slices.map((slice, index) => (
                  <SliceRow key={index} slice={slice} regValue={item.value ?? 0} />
                ))}
              </div>
            )}
            </>
          );
        }}
      />
    </div>
  );
};


/**
 * The panel header's pop-out button: opens the Next Registers document, which shows the same
 * registers with the room of a document — grouping by index or by category, the bits drawn field
 * by field and an inspector column.
 */
export const NextRegPanelActions = (_props: SideBarPanelBadgeProps) => {
  const t = useT();
  const { ideCommandsService } = useAppServices();
  return (
    <SmallIconButton
      iconName="square-arrow-out-up-right"
      title={t("panels.side.nextReg.popOut")}
      clicked={() => void ideCommandsService.executeCommand("show-nextregs")}
    />
  );
};
