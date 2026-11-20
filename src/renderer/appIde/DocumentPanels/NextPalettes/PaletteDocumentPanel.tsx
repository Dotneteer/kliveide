import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import classnames from "classnames";

import { MI_ZXNEXT } from "@common/machines/constants";
import type { PaletteDeviceInfo, PaletteWriteEvent } from "@common/messaging/EmuApi";
import { describePaletteWriter } from "@common/zxnext/palette/paletteStops";
import { useT } from "@common/i18n/useT";
import { setIdeStatusMessageAction } from "@common/state/actions";
import { paletteCodeFromDeviceValue } from "@emu/machines/zxNext/palette";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { SmallIconButton } from "@controls/IconButton";
import { Icon } from "@renderer/controls/Icon";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import { DataPanel, EmptyState, PanelHeader, PanelHeaderActions, PanelHeaderGroup } from "@renderer/controls/data";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import {
  NEXT_PALETTE_DEVICES,
  nextPaletteDevice,
  type NextPaletteDeviceId
} from "@renderer/features/next-palette/nextPaletteDevices";
import { writtenEntryCount } from "@renderer/features/next-palette/nextPaletteRead";
import {
  DEFAULT_PALETTE_DOCUMENT_VIEW_STATE,
  deviceIsWatched,
  entryBreakpoint,
  entryBreakpointCommand,
  entryDetails,
  followTarget,
  formatEntry,
  formatRgb333,
  isTransparentEntry,
  lastWriteOfEntry,
  previousValue,
  slotOf,
  slotValues,
  transparentEntries,
  watchedEntries,
  writtenEntries,
  type PaletteDocumentViewState
} from "@renderer/features/next-palette/paletteDocumentModel";
import { onPaletteReveal } from "@renderer/features/next-palette/paletteReveal";
import { useNextPaletteState } from "@renderer/features/next-palette/useNextPaletteState";
import { usePaletteBreakpoints } from "@renderer/features/next-palette/usePaletteBreakpoints";
import { HistoryPresentBanner } from "../../debugger/history/HistoryPresentBanner";
import styles from "./PaletteDocument.module.scss";

/*
 * The Palette document (`$palettes`, `dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §4): one device's two
 * banks side by side, what was written since the last stop (with the colour it replaced), the
 * entries a `pal:` breakpoint watches, and the selected entry's details with the breakpoint actions.
 * The Next Palettes panel stays the compact overview; this is where palettes are debugged. It is a
 * viewer (D4): nothing here writes a palette.
 */

/** The swatch size of the document's grids */
const CELL_SIZE = 16;

const PaletteDocumentPanel = ({ document, viewState }: DocumentProps<Partial<PaletteDocumentViewState>>) => {
  const t = useT();
  const dispatch = useDispatch();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const documentHubService = useDocumentHubService();
  const { info, baseline, lastWrite, stopId } = useNextPaletteState();
  const paletteBps = usePaletteBreakpoints();

  const [look, setLook] = useState<PaletteDocumentViewState>({
    ...DEFAULT_PALETTE_DOCUMENT_VIEW_STATE,
    ...(viewState ?? {})
  });
  const updateLook = useCallback(
    (patch: Partial<PaletteDocumentViewState>) => {
      setLook((current) => {
        const next = { ...current, ...patch };
        if (document) documentHubService?.setDocumentViewState(document.id, next);
        return next;
      });
    },
    [document, documentHubService]
  );

  // --- Follow: once per stop, to the write that stopped the machine or the first entry written
  useEffect(() => {
    if (!look.follow || stopId === undefined) return;
    const target = followTarget(info, lastWrite);
    if (target) updateLook(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopId, look.follow]);

  // --- `show-palettes <device>` selects a device
  useEffect(() => onPaletteReveal((device) => updateLook({ device })), [updateLook]);

  if (machineId !== MI_ZXNEXT) {
    return (
      <DataPanel xclass={styles.panel}>
        <EmptyState message={t("panels.doc.palettes.notAvailable")} />
      </DataPanel>
    );
  }
  if (!info) {
    return (
      <DataPanel xclass={styles.panel}>
        <EmptyState message={t("panels.side.palette.empty")} />
      </DataPanel>
    );
  }

  const device = nextPaletteDevice(look.device);
  const liveBank = device.liveBank(info);
  const reportStatus = (message?: string) => {
    if (message) dispatch(setIdeStatusMessageAction(message, false));
  };

  return (
    <DataPanel xclass={styles.panel}>
      <HistoryPresentBanner subject="nextPalettes" />
      <PanelHeader>
        <PanelHeaderGroup>
          <span className={styles.devices} role="tablist" aria-label={t("panels.doc.palettes.devices")}>
            {NEXT_PALETTE_DEVICES.map((d) => (
              <DeviceTab
                key={d.id}
                id={d.id}
                info={info}
                selected={d.id === look.device}
                watched={deviceIsWatched(paletteBps.breakpoints, d.id)}
                onSelect={() => updateLook({ device: d.id })}
              />
            ))}
          </span>
        </PanelHeaderGroup>
        <PanelHeaderActions>
          <LabeledSwitch
            value={look.follow}
            label={t("panels.doc.palettes.follow")}
            title={t("panels.doc.palettes.followTitle")}
            clicked={(follow) => updateLook({ follow })}
          />
        </PanelHeaderActions>
      </PanelHeader>

      <div className={styles.layout}>
        <ScrollViewer className={styles.banksScroll}>
          <div className={styles.banks}>
            {([0, 1] as const).map((bank) => (
              <BankColumn
                key={bank}
                device={look.device}
                bank={bank}
                info={info}
                baseline={baseline}
                live={liveBank === bank}
                breakpoints={paletteBps.breakpoints}
                selectedIndex={look.bank === bank ? look.index : undefined}
                onSelect={(index) => updateLook({ bank, index })}
                onToggleBreakpoint={(index) =>
                  void paletteBps.toggle(look.device, bank, index).then((r) => !r?.success && reportStatus(r?.finalMessage))
                }
                onBreakWhenChanged={(index) =>
                  void paletteBps
                    .toggle(look.device, bank, index, true)
                    .then((r) => !r?.success && reportStatus(r?.finalMessage))
                }
                onEditBreakpoint={(index) => void paletteBps.edit(look.device, bank, index)}
              />
            ))}
          </div>
        </ScrollViewer>
        <EntryDetails
          device={look.device}
          bank={look.bank}
          index={look.index}
          info={info}
          baseline={baseline}
          lastWrite={lastWrite}
          hasBreakpoint={!!entryBreakpoint(paletteBps.breakpoints, look.device, look.bank, look.index)}
          onToggleBreakpoint={() =>
            void paletteBps
              .toggle(look.device, look.bank, look.index)
              .then((r) => !r?.success && reportStatus(r?.finalMessage))
          }
          onBreakWhenChanged={() =>
            void paletteBps
              .toggle(look.device, look.bank, look.index, true)
              .then((r) => !r?.success && reportStatus(r?.finalMessage))
          }
          onEditBreakpoint={() => void paletteBps.edit(look.device, look.bank, look.index)}
        />
      </div>
    </DataPanel>
  );
};

/** A device's tab: its name, the live bank, a dot when written since the last stop, a breakpoint dot */
const DeviceTab = ({
  id,
  info,
  selected,
  watched,
  onSelect
}: {
  id: NextPaletteDeviceId;
  info: PaletteDeviceInfo;
  selected: boolean;
  watched: boolean;
  onSelect: () => void;
}) => {
  const t = useT();
  const device = nextPaletteDevice(id);
  const written = device.slots.reduce((sum, slot) => sum + writtenEntryCount(info, slot), 0);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={styles.deviceTab}
      title={
        written
          ? t("panels.doc.palettes.deviceWrittenTitle", { device: device.label, count: written })
          : undefined
      }
      onClick={onSelect}
    >
      {watched && (
        <span className={styles.tabWatch} role="img" aria-label={t("panels.doc.palettes.deviceWatched")}>
          <Icon iconName="circle-filled" width={7} height={7} fill="--color-breakpoint-binary" />
        </span>
      )}
      <span>{device.label}</span>
      <span className={styles.liveChip}>{t("panels.doc.palettes.liveBankChip", { bank: device.liveBank(info) + 1 })}</span>
      {written > 0 && <span className={styles.tabWritten} />}
    </button>
  );
};

type BankColumnProps = {
  device: NextPaletteDeviceId;
  bank: 0 | 1;
  info: PaletteDeviceInfo;
  baseline?: PaletteDeviceInfo;
  live: boolean;
  breakpoints: Parameters<typeof watchedEntries>[0];
  selectedIndex?: number;
  onSelect: (index: number) => void;
  onToggleBreakpoint: (index: number) => void;
  onBreakWhenChanged: (index: number) => void;
  onEditBreakpoint: (index: number) => void;
};

/** One bank: its heading, then the 16x16 grid with the document's marks and the context menu */
const BankColumn = ({
  device,
  bank,
  info,
  baseline,
  live,
  breakpoints,
  selectedIndex,
  onSelect,
  onToggleBreakpoint,
  onBreakWhenChanged,
  onEditBreakpoint
}: BankColumnProps) => {
  const t = useT();
  const slot = slotOf(device, bank);
  const values = slotValues(info, slot);
  const palette = useMemo(() => values.map((v) => paletteCodeFromDeviceValue(v)), [values]);
  const written = useMemo(() => writtenEntries(info, slot), [info, slot]);
  const previous = useMemo(() => {
    const map = new Map<number, number>();
    for (const index of written) {
      const old = previousValue(info, baseline, slot, index);
      if (old !== undefined) map.set(index, paletteCodeFromDeviceValue(old));
    }
    return map;
  }, [info, baseline, slot, written]);
  const watched = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const [index, mark] of watchedEntries(breakpoints, slot)) map.set(index, mark.enabled);
    return map;
  }, [breakpoints, slot]);
  const transparent = useMemo(() => transparentEntries(info, device, bank), [info, device, bank]);

  const [menuState, menuApi] = useContextMenuState();
  const [menuIndex, setMenuIndex] = useState<number>();
  const showMenu = (index: number, e: ReactMouseEvent) => {
    e.preventDefault();
    setMenuIndex(index);
    onSelect(index);
    menuApi.show(e);
  };
  const fromMenu = (action: (index: number) => void) => () => {
    menuApi.conceal();
    if (menuIndex !== undefined) action(menuIndex);
  };
  const menuHasBreakpoint =
    menuIndex !== undefined && !!entryBreakpoint(breakpoints, device, bank, menuIndex);

  return (
    <section className={styles.bank} aria-label={t("panels.doc.palettes.bankTitle", { bank: bank + 1 })}>
      <div className={styles.bankHead}>
        <span className={styles.bankName}>{t("panels.doc.palettes.bankTitle", { bank: bank + 1 })}</span>
        {live ? (
          <span className={classnames(styles.tag, styles.tagLive)}>{t("panels.doc.palettes.live")}</span>
        ) : (
          <span className={styles.tag}>{nextPaletteDevice(device).liveSource}</span>
        )}
        {written.size > 0 && (
          <span className={classnames(styles.tag, styles.tagWritten)}>
            {t("panels.doc.palettes.writtenCount", { count: written.size })}
          </span>
        )}
      </div>
      <NextPaletteViewer
        palette={palette}
        cellSize={CELL_SIZE}
        usePriority={false}
        transparentIndexes={transparent}
        writtenIndexes={written}
        previousCodes={previous}
        watchedIndexes={watched}
        allowSelection={true}
        selectedIndex={selectedIndex}
        onSelection={onSelect}
        onRightClick={showMenu}
      />
      <ContextMenu state={menuState} onClickOutside={() => menuApi.conceal()}>
        <ContextMenuItem
          text={
            menuHasBreakpoint
              ? t("panels.doc.palettes.removeBreakpoint")
              : t("panels.doc.palettes.breakOnWrites", { entry: formatEntry(menuIndex ?? 0) })
          }
          clicked={fromMenu(onToggleBreakpoint)}
        />
        {!menuHasBreakpoint && (
          <ContextMenuItem
            text={t("panels.doc.palettes.breakWhenChanged", { entry: formatEntry(menuIndex ?? 0) })}
            clicked={fromMenu(onBreakWhenChanged)}
          />
        )}
        {menuHasBreakpoint && (
          <ContextMenuItem
            text={t("panels.doc.palettes.editBreakpoint")}
            iconName="pencil"
            clicked={fromMenu(onEditBreakpoint)}
          />
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          text={t("panels.doc.palettes.copyBpSet")}
          clicked={fromMenu((index) => void copyText(entryBreakpointCommand(device, bank, index)))}
        />
      </ContextMenu>
    </section>
  );
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // --- The clipboard can refuse; the text is still on screen to select by hand
    return false;
  }
}

type EntryDetailsProps = {
  device: NextPaletteDeviceId;
  bank: 0 | 1;
  index: number;
  info: PaletteDeviceInfo;
  baseline?: PaletteDeviceInfo;
  lastWrite?: PaletteWriteEvent;
  hasBreakpoint: boolean;
  onToggleBreakpoint: () => void;
  onBreakWhenChanged: () => void;
  onEditBreakpoint: () => void;
};

/** The selected entry, decoded, with the breakpoint actions */
const EntryDetails = ({
  device,
  bank,
  index,
  info,
  baseline,
  lastWrite,
  hasBreakpoint,
  onToggleBreakpoint,
  onBreakWhenChanged,
  onEditBreakpoint
}: EntryDetailsProps) => {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const slot = slotOf(device, bank);
  const value = slotValues(info, slot)[index] ?? 0;
  const details = entryDetails(value);
  const old = previousValue(info, baseline, slot, index);
  const oldDetails = old !== undefined ? entryDetails(old) : undefined;
  const written = writtenEntries(info, slot).has(index);
  const hit = lastWriteOfEntry(lastWrite, slot, index);
  const command = entryBreakpointCommand(device, bank, index);
  const def = nextPaletteDevice(device);
  const hex2 = (v: number) => `$${v.toString(16).toUpperCase().padStart(2, "0")}`;

  const copy = async () => {
    if (await copyText(command)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <aside className={styles.details} aria-label={t("panels.doc.palettes.details")}>
      <PanelHeader>
        <span className={styles.detailsTitle}>
          {t("panels.doc.palettes.entryTitle", { device: def.label, bank: bank + 1, entry: formatEntry(index) })}
        </span>
      </PanelHeader>
      <ScrollViewer className={styles.detailsScroll}>
        <div className={styles.detailsBody}>
          <div className={styles.swatchRow}>
            <span className={styles.bigSwatch} style={{ background: details.css }}>
              {oldDetails && oldDetails.rgb333 !== details.rgb333 && (
                <span className={styles.bigSwatchOld} style={{ borderBottomColor: oldDetails.css }} />
              )}
            </span>
            <span className={styles.swatchStatus}>
              {!written
                ? t("panels.doc.palettes.unchanged")
                : old !== undefined && old === value
                  ? t("panels.doc.palettes.rewritten")
                  : t("panels.doc.palettes.written")}
            </span>
          </div>
          <dl className={styles.kv}>
            <dt>{t("panels.doc.palettes.rgb333")}</dt>
            <dd>
              <span className={styles.value}>{formatRgb333(details.rgb333)}</span>
              {oldDetails && oldDetails.rgb333 !== details.rgb333 && (
                <span className={styles.oldValue}>{t("panels.doc.palettes.was", { value: formatRgb333(oldDetails.rgb333) })}</span>
              )}
            </dd>
            <dt>{t("panels.doc.palettes.components")}</dt>
            <dd className={styles.value}>
              {details.red} / {details.green} / {details.blue}
            </dd>
            <dt>{t("panels.doc.palettes.nextReg41")}</dt>
            <dd className={styles.value}>{hex2(details.nextReg41)}</dd>
            <dt>{t("panels.doc.palettes.nextReg44")}</dt>
            <dd className={styles.value}>
              {hex2(details.nextReg44[0])}, {hex2(details.nextReg44[1])}
            </dd>
            {device === "layer2" && (
              <>
                <dt>{t("panels.doc.palettes.priority")}</dt>
                <dd>{details.priority ? t("panels.doc.palettes.yes") : t("panels.doc.palettes.no")}</dd>
              </>
            )}
            <dt>{t("panels.doc.palettes.css")}</dt>
            <dd className={styles.value}>{details.css}</dd>
            <dt>{t("panels.doc.palettes.transparent")}</dt>
            <dd>
              {isTransparentEntry(info, device, index, value)
                ? t("panels.doc.palettes.transparentYes", {
                    reg: device === "sprites" ? "$4B" : device === "tilemap" ? "$4C" : "$14"
                  })
                : t("panels.doc.palettes.no")}
            </dd>
            {hit && (
              <>
                <dt>{t("panels.doc.palettes.lastWrite")}</dt>
                <dd>
                  {t("panels.doc.palettes.lastWriteValue", {
                    pc: `$${hit.pc.toString(16).toUpperCase().padStart(4, "0")}`,
                    writer: describePaletteWriter(hit)
                  })}
                </dd>
              </>
            )}
          </dl>
          <div className={styles.actions}>
            <button type="button" className={styles.action} onClick={onToggleBreakpoint}>
              <span className={styles.actionDot} />
              {hasBreakpoint
                ? t("panels.doc.palettes.removeBreakpoint")
                : t("panels.doc.palettes.breakOnWrites", { entry: formatEntry(index) })}
            </button>
            {hasBreakpoint ? (
              <button type="button" className={styles.action} onClick={onEditBreakpoint}>
                {t("panels.doc.palettes.editBreakpoint")}
              </button>
            ) : (
              <button type="button" className={styles.action} onClick={onBreakWhenChanged}>
                {t("panels.doc.palettes.breakWhenChanged", { entry: formatEntry(index) })}
              </button>
            )}
          </div>
          <div className={styles.command}>
            <code>{command}</code>
            <SmallIconButton
              iconName={copied ? "check" : "copy"}
              title={copied ? t("panels.doc.palettes.copied") : t("panels.doc.palettes.copyBpSet")}
              clicked={copy}
            />
          </div>
        </div>
      </ScrollViewer>
    </aside>
  );
};

export const createPaletteDocumentPanel = ({ document, viewState }: DocumentProps) => (
  <PaletteDocumentPanel document={document} viewState={viewState} />
);
