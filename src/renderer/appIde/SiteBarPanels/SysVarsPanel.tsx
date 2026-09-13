import type { SysVar } from "@abstractions/SysVar";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SysVarType } from "@abstractions/SysVar";
import { Icon } from "@renderer/controls/Icon";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import {
  AddressLabel,
  DataLabel,
  DataPanel,
  DataRow,
  DataSecondary,
  EmptyState,
  HexByteGrid,
  HexValue,
  PanelFilter,
  byteTooltip,
  formatHex
} from "@renderer/controls/data";
import dataStyles from "@renderer/controls/data/Data.module.scss";
import { FlagRow } from "@renderer/controls/data/registers";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { iconSizes } from "@renderer/theming/tokens/dimensions";

import { useEmuStateListener } from "../useStateRefresh";
import styles from "./SysVarsPanel.module.scss";

/**
 * `$5C00` — four hex digits and the prefix. Every machine's system variables live in the 16-bit
 * address space, so this column never has to grow.
 *
 * `ch`, not px: this survives a font or size change (M2).
 */
const ADDRESS_WIDTH = 5;

/**
 * The name column. The longest name in any of the four tables is `COORDSULA` (ZX Next) at exactly
 * nine characters — measured across every `*SysVars.ts`, not guessed — so nine is the width at
 * which no name ever wraps and no row pays for one that might.
 */
const NAME_WIDTH = 9;

/**
 * How much of an array variable a collapsed row shows: one `HexByteGrid` row.
 *
 * An array longer than this collapses. The tables contain `TSTACK` at 115 bytes (ZX 128) and
 * `TBUFFER` at 192 (C64) — 15 and 24 grid rows dropped into a list of 22px ones, which is what made
 * this panel unscrollable in practice. At or below one grid row there is nothing to collapse, and a
 * chevron on a row that is already one line tall is pure friction.
 */
const PREVIEW_BYTES = 8;

/** A system variable's identity. Two variables can share an address (`K-DATA` and `TVDATA` both
 * live at `$5C0D`), so the name is part of the key. */
const varKey = (sysVar: SysVar) => `${sysVar.name}@${sysVar.address}`;

type SysVarSample = {
  sysVar: SysVar;
  /** Bytes the variable occupies — 1, 2, or its declared array length. */
  length: number;
  /** Byte, word and flag variables. */
  value?: number;
  /** Array variables. */
  bytes?: Uint8Array;
  /** The scalar moved since the previous refresh. */
  changed: boolean;
  /** Which array bytes moved since the previous refresh. */
  changedBytes?: boolean[];
};

/** The previous sample of one variable, kept to answer "did this move?" on the next refresh. */
type Previous = Map<string, number | Uint8Array>;

/**
 * Read one variable out of a memory snapshot, and say what moved since last time.
 *
 * The first sample of a variable is never "changed": `previous` has no entry for it, and marking
 * the whole panel as changed the moment it opens would make the signal mean "this panel is new"
 * rather than "this value moved".
 */
function sample(sysVar: SysVar, memory: Uint8Array, previous: Previous): SysVarSample {
  const addr = sysVar.address;
  const key = varKey(sysVar);
  const before = previous.get(key);

  switch (sysVar.type) {
    case SysVarType.Word: {
      const value = memory[addr] + (memory[addr + 1] << 8);
      previous.set(key, value);
      return { sysVar, length: 2, value, changed: before !== undefined && before !== value };
    }

    case SysVarType.Array: {
      const length = sysVar.length ?? 0;
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) bytes[i] = memory[addr + i];
      const beforeBytes = before instanceof Uint8Array ? before : undefined;
      const changedBytes =
        beforeBytes && beforeBytes.length === length
          ? Array.from(bytes, (b, i) => b !== beforeBytes[i])
          : undefined;
      previous.set(key, bytes);
      return {
        sysVar,
        length,
        bytes,
        changed: !!changedBytes?.some(Boolean),
        changedBytes
      };
    }

    default: {
      // --- Byte and Flags are both a single byte; they differ only in how the row draws them.
      const value = memory[addr];
      previous.set(key, value);
      return { sysVar, length: 1, value, changed: before !== undefined && before !== value };
    }
  }
}

/** `$5C00 (23552) · 8 bytes` — the second line of every variable's tooltip. */
function whatItIs(sample: SysVarSample): string {
  const { sysVar, length } = sample;
  const where = `${formatHex(sysVar.address, 4)} (${sysVar.address})`;
  switch (sysVar.type) {
    case SysVarType.Word:
      return `${where} · word`;
    case SysVarType.Flags:
      return `${where} · flags`;
    case SysVarType.Array:
      return `${where} · ${length} ${length === 1 ? "byte" : "bytes"}`;
    default:
      return `${where} · byte`;
  }
}

/**
 * A value's classes: the register/state accent, plus the changed wash when it moved.
 *
 * The wash rather than `.changed`, whose *colour* (`--data-changed`) is the same
 * `--accent-text` this panel's values already carry — see the comment over `.changedWash` in
 * `Data.module.scss`.
 */
const hexClass = (changed: boolean) =>
  changed ? `${regStyles.stateValue} ${dataStyles.changedWash}` : regStyles.stateValue;

/** What the pointer is over inside a row: one array byte, one flag bit, or the variable itself. */
type RowHover = { kind: "byte" | "bit"; index: number } | null;

type SysVarRowProps = {
  index: number;
  sample: SysVarSample;
  expanded: boolean;
  toggle: () => void;
};

/**
 * One system variable.
 *
 * **One tooltip, whose content depends on what the pointer is over.** A row here can hold eight
 * flag bits or 192 array bytes, each with its own description, and the primitives that draw those
 * used to answer with a tooltip apiece — a native `title` on every byte, a `TooltipFactory` on
 * every bit — while the row wanted one of its own for the variable. That is two tooltip boxes for
 * one pointer. `MemoryDumpSection` had already settled the shape: the row owns the tooltip and the
 * hovered cell only reports its index (`HexByteGrid`'s `onHoverByte`, `FlagRow`'s `onHoverBit`).
 * This is the other half of that contract.
 */
const SysVarRow = ({ index, sample: item, expanded, toggle }: SysVarRowProps) => {
  const ref = useTooltipRef<HTMLDivElement>();
  const [hover, setHover] = useState<RowHover>(null);
  const { sysVar, value, bytes, changed, changedBytes } = item;
  const type = sysVar.type;

  const collapsible = type === SysVarType.Array && (bytes?.length ?? 0) > PREVIEW_BYTES;
  const showGridInRow = type === SysVarType.Array && !collapsible;
  const showPreview = collapsible && !expanded;

  const tooltip = useMemo(() => {
    if (hover?.kind === "byte" && bytes) {
      const address = sysVar.address + hover.index;
      const heading = `${sysVar.name} +${hover.index} · ${formatHex(address, 4)} (${address})`;
      const description = sysVar.byteDescriptions?.[hover.index];
      return `${byteTooltip(heading, bytes[hover.index])}${description ? `\n${description}` : ""}`;
    }
    if (hover?.kind === "bit" && value !== undefined) {
      const bit = (value >> hover.index) & 1;
      const description = sysVar.flagDecriptions?.[hover.index];
      return `${sysVar.name} bit ${hover.index} = ${bit}${description ? `\n${description}` : ""}`;
    }
    return `${sysVar.name}\n${whatItIs(item)}${
      sysVar.description ? `\n${sysVar.description}` : ""
    }`;
  }, [hover, item, sysVar, value, bytes]);

  const hoverByte = (byteIndex: number | null) =>
    setHover(byteIndex === null ? null : { kind: "byte", index: byteIndex });
  const changedFor = (byteIndex: number) => !!changedBytes?.[byteIndex];

  return (
    <div ref={ref} className={styles.sysVarItem}>
      <DataRow index={index} hoverable clicked={collapsible ? toggle : undefined}>
        {/*
         * The disclosure column is present on every row and merely invisible where there is nothing
         * to disclose. A cell that vanishes takes every column after it with it, and this list is
         * read by scanning down the address and name columns.
         */}
        <div
          className={styles.sysVarToggle}
          style={collapsible ? undefined : { visibility: "hidden" }}
          aria-hidden={!collapsible}
        >
          <Icon
            iconName={expanded ? "chevron-down" : "chevron-right"}
            width={iconSizes.sm}
            height={iconSizes.sm}
            fill="--data-label"
          />
        </div>
        <AddressLabel
          text={formatHex(sysVar.address, 4)}
          width={ADDRESS_WIDTH}
          className={styles.sysVarAddress}
        />
        <DataLabel text={sysVar.name} width={NAME_WIDTH} />
        <div className={styles.sysVarValue}>
          {type === SysVarType.Byte && (
            <HexValue
              value={value ?? 0}
              digits={2}
              decimal
              valueXclass={hexClass(changed)}
            />
          )}
          {type === SysVarType.Word && (
            <HexValue
              value={value ?? 0}
              digits={4}
              decimal
              valueXclass={hexClass(changed)}
            />
          )}
          {type === SysVarType.Flags && (
            <FlagRow
              value={value ?? 0}
              flagDescriptions={sysVar.flagDecriptions}
              iconFill="--color-state-value"
              xclass={changed ? dataStyles.changedWash : undefined}
              onHoverBit={(bit) => setHover(bit === null ? null : { kind: "bit", index: bit })}
            />
          )}
          {showGridInRow && (
            <HexByteGrid bytes={bytes ?? []} onHoverByte={hoverByte} changedFor={changedFor} />
          )}
          {showPreview && (
            <HexByteGrid
              bytes={bytes?.subarray(0, PREVIEW_BYTES) ?? []}
              onHoverByte={hoverByte}
              changedFor={changedFor}
            />
          )}
          {collapsible && (
            <DataSecondary text={`(${bytes?.length ?? 0} bytes)`} xclass={styles.sysVarCount} />
          )}
        </div>
      </DataRow>
      {collapsible && expanded && (
        <div className={styles.sysVarDump}>
          <HexByteGrid bytes={bytes ?? []} onHoverByte={hoverByte} changedFor={changedFor} />
        </div>
      )}
      <TooltipFactory
        refElement={ref.current}
        placement="right"
        offsetX={0}
        offsetY={0}
        showDelay={100}
        content={tooltip}
      />
    </div>
  );
};

export const SysVarsPanel = () => {
  const emuApi = useEmuApi();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const [sysVars, setSysVars] = useState<SysVar[]>([]);
  const [samples, setSamples] = useState<SysVarSample[]>([]);
  const [filter, setFilter] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const previous = useRef<Previous>(new Map());

  /*
   * The variable *table* is static per machine; only its values move.
   *
   * This used to be fetched on every refresh, alongside the memory snapshot — two IPC round trips
   * per tick where one of them could only ever return the same 69 (or 244) descriptors it returned
   * the tick before. `machineId` is what actually invalidates it.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const vars = await emuApi.getSysVars();
      if (cancelled) return;
      previous.current.clear();
      setExpandedKeys({});
      setSamples([]);
      setSysVars(vars ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [emuApi, machineId]);

  /*
   * `useCallback`, not a plain function, because `useEmuStateListener` keys its subscription on the
   * callback's identity: a fresh closure every render unsubscribes and re-subscribes the panel on
   * every render, and this one re-renders on every tick. The identity now changes only when the
   * table or the API does.
   */
  const refreshValues = useCallback(async () => {
    if (!sysVars.length) {
      setSamples([]);
      return;
    }
    const memResponse = await emuApi.getMemoryContents();
    const memory = memResponse.memory;
    setSamples(sysVars.map((sysVar) => sample(sysVar, memory, previous.current)));
  }, [emuApi, sysVars]);

  // --- The first draw. `useEmuStateListener` polls from here on, but its first callback is up to
  // --- 750ms away while the machine runs, and the table has only just arrived.
  useEffect(() => {
    void refreshValues();
  }, [refreshValues]);

  useEmuStateListener(emuApi, refreshValues);

  const query = filter.trim().toLowerCase();

  /*
   * Name or address, and nothing else.
   *
   * Matching the descriptions too was tempting — they are the only prose in the panel — but a hit
   * the reader cannot see in the row it produced reads as a bug. `formatHex` is what the address
   * column itself shows, so typing what is on screen (`5c0`, `$5C`) matches what is on screen.
   */
  const visible = useMemo(
    () =>
      query
        ? samples.filter(
            ({ sysVar }) =>
              sysVar.name.toLowerCase().includes(query) ||
              formatHex(sysVar.address, 4).toLowerCase().includes(query)
          )
        : samples,
    [samples, query]
  );

  return (
    <DataPanel>
      {samples.length > 0 && (
        <PanelFilter
          value={filter}
          onChange={setFilter}
          placeholder="Name or address"
          label="Filter system variables"
          status={query ? `${visible.length} / ${samples.length}` : undefined}
        />
      )}
      {samples.length === 0 && <EmptyState message="No system variables available" />}
      {samples.length > 0 && visible.length === 0 && (
        <EmptyState message={`No system variable matches "${filter.trim()}"`} motif={false} />
      )}
      {visible.length > 0 && (
        <VirtualizedList
          items={visible}
          /*
           * A row here can be an eight-byte hex grid beside an address, a name and a count, which
           * is wider than a narrow sidebar. Without this the overflow is simply clipped: `virtua`
           * gives every row an absolutely positioned wrapper of viewport width, and only that
           * wrapper's border box reaches the scroll container. `WatchPanel` opts in for the same
           * reason.
           */
          scrollRowsHorizontally
          renderItem={(idx) => {
            const item = visible[idx];
            const key = varKey(item.sysVar);
            return (
              <SysVarRow
                key={key}
                index={idx}
                sample={item}
                expanded={!!expandedKeys[key]}
                toggle={() =>
                  setExpandedKeys((keys) => ({ ...keys, [key]: !keys[key] }))
                }
              />
            );
          }}
        />
      )}
    </DataPanel>
  );
};
