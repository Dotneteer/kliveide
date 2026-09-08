import { Flag } from "@renderer/controls/layout/Flag";
import { Label } from "@renderer/controls/layout/Label";
import { Value } from "@renderer/controls/layout/Value";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import classnames from "classnames";
import { useState, type ReactNode } from "react";
import { toHexa2, toHexa6 } from "../services/ide-commands";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./MemMappingPanel.module.scss";
import { useEmuApi } from "@renderer/core/EmuApi";
import { NextMemoryMapping } from "@common/messaging/EmuApi";
import { byteTooltip, DataRow } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";

/** The token every value in this panel is drawn with; labels stay on `--data-label`. */
const VALUE_FILL = "--color-state-value";

/** The eight 8K pages the Next maps, in order. */
const PAGES = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * The bank pair in a page row: two hex bytes and the space between them. `-1` for a ROM page's
 * missing 16K bank is also two characters, so every row fills this exactly.
 */
const BANKS_WIDTH = "5ch";

/**
 * The single-byte rows between "All RAM" and "DivMMC", which differ only in their label and which
 * field they read. They were ten near-identical blocks; `tip` is the tooltip heading, since "Port
 * 7FFD" on its own does not say what the number under the cursor is.
 */
const BYTE_ROWS: {
  label: string;
  tip: string;
  get: (m: NextMemoryMapping | null) => number | undefined;
}[] = [
  { label: "Current ROM:", tip: "Selected ROM", get: (m) => m?.selectedRom },
  { label: "Current Bank:", tip: "Selected bank", get: (m) => m?.selectedBank },
  { label: "Port 7FFD:", tip: "Port $7FFD", get: (m) => m?.port7ffd },
  { label: "Port 1FFD:", tip: "Port $1FFD", get: (m) => m?.port1ffd },
  { label: "Port DFFD:", tip: "Port $DFFD", get: (m) => m?.portDffd },
  { label: "Port EFF7:", tip: "Port $EFF7", get: (m) => m?.portEff7 },
  { label: "Port L2:", tip: "Layer 2 port", get: (m) => m?.portLayer2 },
  { label: "Port Timex:", tip: "Timex port", get: (m) => m?.portTimex }
];

type PageInfo = NextMemoryMapping["pageInfo"][number];

/**
 * Whether a page field carries no value.
 *
 * **`null`, not just `undefined`.** `writeOffset` arrives as `null` for the ROM pages, and the row
 * below only survives it because `??` catches both — a `=== undefined` test does not, and letting a
 * `null` through to `toHexa6` throws `Cannot read properties of null`, which takes the whole
 * renderer down with it rather than just this panel.
 */
const isMissing = (value: number | null | undefined): value is null | undefined =>
  value === null || value === undefined;

/**
 * A bank number for display, or `--` where the page has none.
 *
 * A ROM page has no 16K bank and the emulator reports it as **-1**, which printed literally as
 * `-1` — a number that looks like data. `--` is what this app already uses for a byte it does not
 * have (`Bit8Value` renders `--`, `Bit16Value` renders `----`), and it is two characters wide like
 * the hex it replaces, so the bank column stays on its grid.
 */
const bankText = (bank: number | null | undefined): string =>
  isMissing(bank) || bank < 0 ? "--" : toHexa2(bank);

/** The same bank, spelled out for the tooltip: hex and decimal, or `none`. */
const bankTooltipText = (bank: number | null | undefined): string =>
  isMissing(bank) || bank < 0 ? "none" : `$${toHexa2(bank)} (${bank})`;

/**
 * The four unlabelled numbers in a page row, named.
 *
 * The row prints `bank8k bank16k readOffset writeOffset` as one run of hex with nothing to say
 * which is which, so the tooltip is where that is spelled out — the same job the memory dump's byte
 * tooltip does for its columns.
 */
const pageTooltip = (page: number, info: PageInfo): string =>
  [
    `Page ${page}`,
    `8K bank: ${bankTooltipText(info.bank8k)}`,
    // A ROM page has no 16K bank; the row shows `--` and this spells it out. Hex-formatting the
    // emulator's -1 would read `$-1`, which looks like data.
    `16K bank: ${bankTooltipText(info.bank16k)}`,
    `Read offset: ${isMissing(info.readOffset) ? "none" : `$${toHexa6(info.readOffset)}`}`,
    // Likewise: an absent write offset is the row's `?? 0xff` placeholder, not an address.
    `Write offset: ${isMissing(info.writeOffset) ? "none" : `$${toHexa6(info.writeOffset)}`}`
  ].join("\n");

/**
 * A row whose tooltip covers the **whole row**, not just the cell holding the number.
 *
 * `controls/layout`'s `Value`/`Flag` each bind their own tooltip to their own cell, which means the
 * hit area is a two-character hex value — easy to miss, and it leaves most of a wide row inert. The
 * row is what the reader is pointing at, so the row is what carries the tooltip: `DataRow` forwards
 * its ref, and `TooltipFactory` binds `mouseenter`/`mouseleave` to whatever element it is given.
 *
 * `TooltipFactory` renders nothing inline (it portals only while visible), so it is safe as a child
 * of the row's flex container — it adds no cell.
 */
const TipRow = ({ tooltip, children }: { tooltip: string; children: ReactNode }) => {
  const ref = useTooltipRef<HTMLDivElement>();

  return (
    <DataRow hoverable ref={ref}>
      {children}
      <TooltipFactory
        refElement={ref.current}
        placement="right"
        offsetX={0}
        offsetY={0}
        showDelay={100}
        content={tooltip}
      />
    </DataRow>
  );
};

export const MemMappingPanel = () => {
  const emuApi = useEmuApi();
  const [mappingState, setMappingState] = useState<NextMemoryMapping | null>(null);

  // --- This function queries the breakpoints from the emulator
  const refreshMemoryMappingState = async () => {
    const response = await emuApi.getNextMemoryMapping();
    setMappingState(response);
  };

  // --- Take care of refreshing the screen
  useEmuStateListener(emuApi, async () => {
    await refreshMemoryMappingState();
  });

  let allRamValue = mappingState?.allRamsBanks
    ? `[${mappingState.allRamsBanks.map((i) => toHexa2(i)).join(", ")}]`
    : "Off";
  return (
    <div className={styles.memMappingPanel}>
      <DataRow hoverable>
        <Label text="All RAM:" className={styles.memMapLabel} />
        <Value text={allRamValue} className={regStyles.stateValue} />
      </DataRow>
      {BYTE_ROWS.map(({ label, get, tip }) => {
        const value = get(mappingState) ?? 0;
        return (
          <TipRow key={label} tooltip={byteTooltip(tip, value)}>
            <Label text={label} className={styles.memMapLabel} />
            <Value text={toHexa2(value)} className={regStyles.stateValue} />
          </TipRow>
        );
      })}
      <TipRow tooltip={byteTooltip("DivMMC control", mappingState?.divMmc ?? 0)}>
        <Label text="DivMMC:" className={styles.memMapLabel} />
        <Value text={toHexa2(mappingState?.divMmc ?? 0)} className={regStyles.stateValue} />
      </TipRow>
      <TipRow tooltip={`DivMMC paged in\n${mappingState?.divMmcIn ? "yes" : "no"}`}>
        <Label text="DivMMC In:" className={styles.memMapLabel} />
        {/*
         * No `width` and `adjustLeft={false}`: both are inline styles on `Flag` and would beat
         * `.memMapFlag`, which is what puts the dot in the value column under the `00` above.
         */}
        <Flag
          value={mappingState?.divMmcIn ?? false}
          iconFill={VALUE_FILL}
          adjustLeft={false}
          className={styles.memMapFlag}
        />
      </TipRow>
      {PAGES.map((page) => {
        const info = mappingState?.pageInfo?.[page];
        if (!info) return null;
        return (
          <TipRow key={page} tooltip={pageTooltip(page, info)}>
            <Label text={`Page ${page}:`} className={styles.memMapLabel} />
            {/*
             * Two cells, not one string: the banks and the offsets are different kinds of number
             * (a bank index against an address into memory), so they take the two accent hues —
             * see `--color-state-value-alt` in componentAliases.ts. The widths hold the columns
             * steady across the eight rows now that a row gap separates the pair instead of a
             * space inside one cell.
             */}
            <Value
              text={`${bankText(info.bank8k)} ${bankText(info.bank16k)}`}
              width={BANKS_WIDTH}
              className={classnames(styles.memMapCell, regStyles.stateValue)}
            />
            <Value
              text={`${toHexa6(info.readOffset)} ${toHexa6(info.writeOffset ?? 0xff)}`}
              className={classnames(styles.memMapCell, regStyles.stateValueAlt)}
            />
          </TipRow>
        );
      })}
    </div>
  );
};

