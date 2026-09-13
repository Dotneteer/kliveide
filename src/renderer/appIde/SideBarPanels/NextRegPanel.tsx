import { Label } from "@renderer/controls/layout/Label";
import { Secondary } from "@renderer/controls/layout/Secondary";
import { Value } from "@renderer/controls/layout/Value";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "@renderer/core/RendererProvider";
import { toBin8, toHexa2 } from "../services/ide-commands";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./NextRegPanel.module.scss";
import {} from "@controls/Tooltip";
import {
  NextRegDescriptor,
  NextRegValueSlice,
  RegValueState
} from "@emu/machines/zxNext/NextRegDevice";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { DataRow } from "@renderer/controls/data";
import { Icon } from "@renderer/controls/Icon";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import classnames from "classnames";

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
  id: number,
  description: string | undefined,
  value: number | undefined,
  lastWrite: number | undefined
) =>
  [
    `Reg $${toHexa2(id)}${description ? ` — ${description}` : ""}`,
    value !== undefined ? valueTooltip("Current value", value) : undefined,
    lastWrite !== undefined ? valueTooltip("Last written", lastWrite) : undefined
  ]
    .filter(Boolean)
    .join("\n\n");

// ---------------------------------------------------------------------------------------------
// Decoding a register's `slices`
// ---------------------------------------------------------------------------------------------

/*
 * `NextRegDevice` documents 73 of its 141 registers field by field — 338 slices in all, 292 of them
 * single bits, 46 multi-bit fields and 21 carrying a named `valueSet`. All of it already travels to
 * the renderer inside `NextRegDescriptor`; until now the panel used only the register's own
 * `description`.
 *
 * Two shapes in that data the helpers below deliberately tolerate rather than assume away:
 *
 *  - **`mask` is optional.** Reg $00 (Machine ID) has a single slice with no mask at all, meaning
 *    "the whole byte". Missing therefore reads as `0xFF`, not as zero.
 *  - **`view` cannot be trusted to say what a slice is.** The type offers `"flag" | "number"`, but
 *    only 8 of the 338 slices set it and every one of those says `"number"` — *no* slice in the
 *    table is marked `"flag"`. So a flag is recognised by its mask holding exactly one bit, which is
 *    true of the data as written; `view` is honoured only as an override where it is present.
 */

const sliceMask = (slice: NextRegValueSlice) => slice.mask ?? 0xff;

/** The slice's own value: masked out of the register byte and shifted down to bit 0. */
const sliceValue = (regValue: number, slice: NextRegValueSlice) =>
  (regValue & sliceMask(slice)) >> (slice.shift ?? 0);

/** A single-bit slice is a flag. See the `view` note above for why the mask decides, not `view`. */
const isFlagSlice = (slice: NextRegValueSlice) => {
  if (slice.view === "number") return false;
  const mask = sliceMask(slice);
  return mask !== 0 && (mask & (mask - 1)) === 0;
};

/** `7` for one bit, `5:0` for a range — the notation the Next documentation itself uses. */
const sliceBits = (slice: NextRegValueSlice) => {
  const mask = sliceMask(slice);
  const high = 31 - Math.clz32(mask);
  const low = Math.log2(mask & -mask);
  return high === low ? `${high}` : `${high}:${low}`;
};

/**
 * The words for a slice's value: the `valueSet` name where one matches, then the slice's own
 * description. Reg $00 has a `valueSet` and no description, most flags have a description and no
 * `valueSet`, and either may be missing, so this is a join of whatever is actually present.
 */
const sliceText = (regValue: number, slice: NextRegValueSlice) => {
  const named = slice.valueSet?.[sliceValue(regValue, slice)];
  return [named, slice.description].filter(Boolean).join(" — ");
};

/**
 * One decoded field of a register.
 *
 * A flag's value is drawn as the same filled/outline circle the Z80, ULA, VIC and Blink panels use
 * for their flags (`flagIcon` in `controls/data/registers.tsx`) rather than as the words "on"/"off":
 * a column of circles can be read down at a glance, where a column of words has to be read word by
 * word. Multi-bit fields keep their hex, because a number is what they are.
 */
const SliceRow = ({ slice, regValue }: { slice: NextRegValueSlice; regValue: number }) => {
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
          content={`Bit${sliceBits(slice).includes(":") ? "s" : ""} ${sliceBits(slice)}\n${text}\n${
            flag ? (value ? "Set" : "Clear") : `$${toHexa2(value)} (${value})`
          }`}
        />
      )}
    </div>
  );
};

/*
 * The descriptor table, cached across mounts.
 *
 * It is static *per machine*, not global — so the machine it was fetched for is cached with it.
 * Keyed on nothing, a Next → Spectrum → Next round trip kept the first machine's slice descriptors
 * and showed them against the second's registers. `SysVarsPanel` re-fetches on `machineId` for the
 * same reason; §12.1 of the modernization plan is the rationale.
 */
let nextRegDescriptors: Record<number, NextRegDescriptor>;
let nextRegDescriptorsMachineId: string | undefined;

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
        content={registerTooltip(item.id, description, item.value, item.lastWrite)}
      />
    </DataRow>
  );
};

export const NextRegPanel = () => {
  const emuApi = useEmuApi();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const [lastRegIndex, setLastRegIndex] = useState<number>();
  const [regVals, setRegVals] = useState<RegValueState[]>();
  /*
   * Descriptors are held in state as well as in the module-level cache.
   *
   * The cache survives remounts so the fetch happens once per session; the state is what makes the
   * rows re-render when it arrives. Without it the panel showed whatever the descriptors happened
   * to be at the last state-refresh tick — tolerable when they fed only a tooltip, not when they
   * decide whether a row has an expander at all.
   */
  const [descriptors, setDescriptors] = useState<Record<number, NextRegDescriptor>>(
    () => nextRegDescriptors
  );
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

  useEffect(() => {
    if (!emuApi) return;
    if (nextRegDescriptors && nextRegDescriptorsMachineId === machineId) {
      setDescriptors(nextRegDescriptors);
      return;
    }
    emuApi.getNextRegDescriptors().then((response) => {
      const table: Record<number, NextRegDescriptor> = {};
      response.descriptors.forEach((d) => {
        table[d.id] = d;
      });
      nextRegDescriptors = table;
      nextRegDescriptorsMachineId = machineId;
      setDescriptors(table);
    });
  }, [emuApi, machineId]);

  // --- `useCallback`: `useEmuStateListener` keys its subscription on the callback's identity, and
  // --- this panel re-renders every tick.
  const refreshNextDeviceState = useCallback(async () => {
    const response = await emuApi.getNextRegState();
    setLastRegIndex(response.lastRegisterIndex);
    setRegVals(response.regs);
  }, [emuApi]);

  useEmuStateListener(emuApi, refreshNextDeviceState);

  return (
    <div className={styles.nextRegPanel}>
      <DataRow hoverable dense xclass={styles.nextRegRow}>
        <Label text={`Last Reg Index:`} className={styles.nextRegHeaderLabel} />
        <Value
          text={toHexa2(lastRegIndex ?? 0)}
          className={regStyles.stateValue}
          tooltip={valueTooltip("Last register index", lastRegIndex ?? 0)}
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

