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
import {
  describeNexBankProvenance,
  getNexLoad
} from "@renderer/appIde/DocumentPanels/Next/nexLoadSession";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { HistoryPresentBanner } from "../debugger/history/HistoryPresentBanner";
import { useT, type TFunction } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";

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
/** A row text: a message key, or a hardware name that stays English (D9) */
type RowText = { key: MessageKey } | { text: string };
const rowText = (t: TFunction, value: RowText) => ("key" in value ? t(value.key) : value.text);

const BYTE_ROWS: {
  id: string;
  label: RowText;
  tip: RowText;
  get: (m: NextMemoryMapping | null) => number | undefined;
}[] = [
  {
    id: "rom",
    label: { key: "panels.side.memMapping.currentRom" },
    tip: { key: "panels.side.memMapping.selectedRom" },
    get: (m) => m?.selectedRom
  },
  {
    id: "bank",
    label: { key: "panels.side.memMapping.currentBank" },
    tip: { key: "panels.side.memMapping.selectedBank" },
    get: (m) => m?.selectedBank
  },
  { id: "7ffd", label: { text: "Port 7FFD:" }, tip: { text: "Port $7FFD" }, get: (m) => m?.port7ffd },
  { id: "1ffd", label: { text: "Port 1FFD:" }, tip: { text: "Port $1FFD" }, get: (m) => m?.port1ffd },
  { id: "dffd", label: { text: "Port DFFD:" }, tip: { text: "Port $DFFD" }, get: (m) => m?.portDffd },
  { id: "eff7", label: { text: "Port EFF7:" }, tip: { text: "Port $EFF7" }, get: (m) => m?.portEff7 },
  {
    id: "l2",
    label: { text: "Port L2:" },
    tip: { key: "panels.side.memMapping.layer2Port" },
    get: (m) => m?.portLayer2
  },
  {
    id: "timex",
    label: { text: "Port Timex:" },
    tip: { key: "panels.side.memMapping.timexPort" },
    get: (m) => m?.portTimex
  }
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
const bankTooltipText = (t: TFunction, bank: number | null | undefined): string =>
  isMissing(bank) || bank < 0 ? t("panels.side.memMapping.none") : `$${toHexa2(bank)} (${bank})`;

/**
 * The four unlabelled numbers in a page row, named.
 *
 * The row prints `bank8k bank16k readOffset writeOffset` as one run of hex with nothing to say
 * which is which, so the tooltip is where that is spelled out — the same job the memory dump's byte
 * tooltip does for its columns.
 */
const pageTooltip = (t: TFunction, page: number, info: PageInfo, provenance?: string): string =>
  [
    t("panels.side.memMapping.page", { page }),
    t("panels.side.memMapping.bank8k", { bank: bankTooltipText(t, info.bank8k) }),
    // A ROM page has no 16K bank; the row shows `--` and this spells it out. Hex-formatting the
    // emulator's -1 would read `$-1`, which looks like data.
    t("panels.side.memMapping.bank16k", { bank: bankTooltipText(t, info.bank16k) }),
    // --- Where that bank's contents came from, when a NEX was launched in this session. A fact
    // --- about the *file*, not a claim about the bank's current contents — see `nexLoadSession.ts`.
    ...(provenance ? [provenance] : []),
    t("panels.side.memMapping.readOffset", {
      offset: isMissing(info.readOffset) ? t("panels.side.memMapping.none") : `$${toHexa6(info.readOffset)}`
    }),
    // Likewise: an absent write offset is the row's `?? 0xff` placeholder, not an address.
    t("panels.side.memMapping.writeOffset", {
      offset: isMissing(info.writeOffset) ? t("panels.side.memMapping.none") : `$${toHexa6(info.writeOffset)}`
    })
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
    <DataRow hoverable dense xclass={styles.memMapRow} ref={ref}>
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
  const t = useT();
  const emuApi = useEmuApi();
  const [mappingState, setMappingState] = useState<NextMemoryMapping | null>(null);

  /*
   * The NEX launched in this session, re-read on every refresh.
   *
   * A module singleton rather than app state, so nothing re-renders on the change — this panel is
   * already refreshing on the emulator's state ticker, and reading it here is what makes the answer
   * current without a subscription. See `nexLoadSession.ts`.
   */
  const [nexLoad, setNexLoad] = useState(getNexLoad());

  // --- This function queries the breakpoints from the emulator
  const refreshMemoryMappingState = async () => {
    const response = await emuApi.getNextMemoryMapping();
    setMappingState(response);
    setNexLoad(getNexLoad());
  };

  // --- Take care of refreshing the screen
  useEmuStateListener(emuApi, async () => {
    await refreshMemoryMappingState();
  });

  let allRamValue = mappingState?.allRamBanks
    ? `[${mappingState.allRamBanks.map((i) => toHexa2(i)).join(", ")}]`
    : t("panels.side.memMapping.off");
  return (
    <div className={styles.memMappingPanel}>
      <HistoryPresentBanner subject="memoryMapping" />
      <DataRow hoverable dense xclass={styles.memMapRow}>
        <Label text={t("panels.side.memMapping.allRam")} className={styles.memMapLabel} />
        <Value text={allRamValue} className={regStyles.stateValue} />
      </DataRow>
      {BYTE_ROWS.map(({ id, label, get, tip }) => {
        const value = get(mappingState) ?? 0;
        return (
          <TipRow key={id} tooltip={byteTooltip(rowText(t, tip), value)}>
            <Label text={rowText(t, label)} className={styles.memMapLabel} />
            <Value text={toHexa2(value)} className={regStyles.stateValue} />
          </TipRow>
        );
      })}
      <TipRow tooltip={byteTooltip(t("panels.side.memMapping.divMmcControl"), mappingState?.divMmc ?? 0)}>
        <Label text="DivMMC:" className={styles.memMapLabel} />
        <Value text={toHexa2(mappingState?.divMmc ?? 0)} className={regStyles.stateValue} />
      </TipRow>
      <TipRow
        tooltip={t(mappingState?.divMmcIn ? "panels.side.memMapping.divMmcPagedIn" : "panels.side.memMapping.divMmcNotPagedIn")}
      >
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
        const provenance = describeNexBankProvenance(nexLoad, info.bank16k);
        return (
          <TipRow key={page} tooltip={pageTooltip(t, page, info, provenance)}>
            <Label text={t("panels.side.memMapping.pageLabel", { page })} className={styles.memMapLabel} />
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

