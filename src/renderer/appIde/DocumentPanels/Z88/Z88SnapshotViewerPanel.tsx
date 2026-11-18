import { useEffect, useMemo, useState } from "react";
import { t as translate, uiLocale } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import {
  Fact,
  FactCells,
  FactFlag,
  FactNote,
  Facts,
  FactSection,
  FactsWithPicture
} from "@renderer/controls/data/FileFacts";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { parseZ88Snapshot } from "@common/z88/z88Snapshot";
import { mapZ88SnapshotToKlive } from "@common/z88/z88SnapshotMapping";
import { adjustZ88LostTime } from "@common/z88/z88Rtc";
import { buildZ88AddressSpace, z88SnapshotBankReader } from "@common/z88/z88AddressSpace";
import {
  formatZ88Ext24,
  z88Pb0Address,
  z88Pb1Address,
  z88Pb2Address,
  z88Pb3Address,
  z88SbfAddress
} from "@common/z88/z88ScreenPointers";
import {
  formatZ88Rtc,
  z88AddressLocation,
  z88BlinkBitNames,
  z88PagedRanges,
  z88SlotBrowserItems,
  z88ViewedCards,
  type Z88BankView,
  type Z88BlinkBitRegister,
  type Z88SnapshotFileInfo
} from "./z88SnapshotView";
import { Z88SlotBrowser } from "./Z88SlotBrowser";
import { z88BankDumpId, z88BankDumpTitle } from "./z88BankDocument";

/*
 * The `.z88` (OZvm snapshot) viewer (`dev/plans/Z88_SNAPSHOT_PLAN.md` §4.8): what the file holds and
 * whether Klive can load it, the Z80 and Blink state, the 64K as the snapshot pages it (with a
 * memory dump and disassembly at PC), and every card bank by bank in the Slots browser
 * (`dev/plans/Z88_SLOT_BROWSER_PLAN.md`), which pops a bank out as its own document.
 *
 * Built from the shared file-facts primitives (`controls/data/FileFacts`); the banks from the Slots browser.
 */

/* --- M2: `ch`, not px */
const LABEL_WIDTH = "12ch";
const REG_LABEL_WIDTH = "5ch";

/** PB0..PB3 decoded to the 24-bit address they point at (issue #1417) */
const PB_DECODERS = [z88Pb0Address, z88Pb1Address, z88Pb2Address, z88Pb3Address];
const REG_CELL_WIDTH = "21ch";
const TIM_LABEL_WIDTH = "6ch";
const BYTE_CELL_WIDTH = "11ch";
const PB_CELL_WIDTH = "24ch";

type Z88SnapshotViewState = {
  scrollPosition?: number;
  summaryExpanded?: boolean;
  cpuExpanded?: boolean;
  blinkExpanded?: boolean;
  pagingExpanded?: boolean;
  breakpointsExpanded?: boolean;
  /** The Slots browser: the selected bank, the filter, and the view each bank last popped out in */
  selectedBank?: number;
  slotFilter?: string;
  bankView?: Record<number, Z88BankView>;
};

type ViewContext = GenericFileContext<Z88SnapshotFileInfo, Z88SnapshotViewState>;

/**
 * Parses a `.z88` file for the viewer. A file Klive cannot *load* still parses: the mapping's
 * errors are shown, not reported as a broken file.
 */
export function loadZ88SnapshotFileContents(contents: Uint8Array): {
  fileInfo?: Z88SnapshotFileInfo;
  error?: string;
} {
  try {
    const snapshot = parseZ88Snapshot(contents);
    return { fileInfo: { snapshot, mapping: mapZ88SnapshotToKlive(snapshot) } };
  } catch (err) {
    return {
      error: translate("panels.z88.error.invalid", { reason: err instanceof Error ? err.message : String(err) })
    };
  }
}

const Z88SnapshotViewerPanel = ({ document, contents, viewState }: DocumentProps<Z88SnapshotViewState>) => (
  <GenericFilePanel<Z88SnapshotFileInfo, Z88SnapshotViewState>
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
    fileLoader={loadZ88SnapshotFileContents}
    validRenderer={(ctx) => (
      <SnapshotView
        ctx={ctx}
        documentSource={document.node?.projectPath ?? document.id}
        fullPath={document.node?.fullPath ?? document.path ?? document.id}
      />
    )}
  />
);

export const createZ88SnapshotViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <Z88SnapshotViewerPanel
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);

type ViewProps = { ctx: ViewContext; documentSource: string; fullPath: string };

/** A module-level component, so it may hold state (see `GenericFilePanel`'s renderer note) */
const SnapshotView = ({ ctx, documentSource, fullPath }: ViewProps) => {
  const info = ctx.fileInfo;
  if (!info) return null;
  return (
    <>
      <SummarySection ctx={ctx} info={info} />
      <CpuSection ctx={ctx} info={info} />
      <BlinkSection ctx={ctx} info={info} />
      <PagingSection ctx={ctx} info={info} documentSource={documentSource} />
      <SlotsSection ctx={ctx} info={info} fullPath={fullPath} />
      <BreakpointsSection ctx={ctx} info={info} />
    </>
  );
};

type SectionProps = { ctx: ViewContext; info: Z88SnapshotFileInfo };

const SummarySection = ({ ctx, info }: SectionProps) => {
  const t = useT();
  const { snapshot, mapping } = info;
  const now = useMemo(() => Date.now(), []);
  const loadable = mapping.errors.length === 0;
  return (
    <FactSection
      title={t("panels.helpers.heading.snapshot")}
      expanded={ctx.viewState?.summaryExpanded ?? true}
      onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.summaryExpanded = exp))}
    >
      <FactsWithPicture picture={snapshot.png && <LcdPicture png={snapshot.png} />}>
        <Facts labelWidth={LABEL_WIDTH}>
          <FactFlag label={t("panels.helpers.label.loadable")} value={loadable} />
          <FactFlag label={t("panels.z88.label.autorun")} value={snapshot.autorun} />
          <Fact label={t("panels.z88.label.savedAt")}>
            {snapshot.stoppedAt !== undefined
              ? new Date(snapshot.stoppedAt).toLocaleString(uiLocale())
              : t("panels.z88.notRecorded")}
          </Fact>
          <Fact label={t("panels.z88.label.rtcSaved")}>{formatZ88Rtc(snapshot.blink.tim)}</Fact>
          <Fact label={t("panels.z88.label.rtcOnLoad")} title={t("panels.z88.rtcOnLoadTooltip")}>
            {formatZ88Rtc(adjustZ88LostTime(snapshot.blink.tim, snapshot.stoppedAt, now))}
          </Fact>
          {/* --- One entry per line: the archive's members on one line pushed the viewer into
              --- horizontal scrolling */}
          {snapshot.entries.map((entry, index) => (
            <Fact key={entry.name} label={index === 0 ? t("panels.z88.label.contents") : ""}>
              {t("panels.z88.entry", { name: entry.name, count: entry.size })}
            </Fact>
          ))}
        </Facts>
        {mapping.errors.map((error, index) => (
          <FactNote key={`error${index}`} tone="error">
            {error}
          </FactNote>
        ))}
        {[...snapshot.warnings, ...mapping.warnings].map((warning, index) => (
          <FactNote key={`warning${index}`} tone="warning">
            {warning}
          </FactNote>
        ))}
      </FactsWithPicture>
    </FactSection>
  );
};

/** The LCD picture OZvm saved; cosmetic, as in OZvm */
const LcdPicture = ({ png }: { png: Uint8Array }) => {
  const t = useT();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const created = URL.createObjectURL(new Blob([png.slice()], { type: "image/png" }));
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [png]);
  return url ? (
    <img src={url} alt={t("panels.z88.lcdAlt")} style={{ imageRendering: "pixelated", maxWidth: "100%" }} />
  ) : null;
};

const Register = ({ label, value }: { label: string; value: number }) => (
  <Fact label={label} tone="state">{`$${toHexa4(value)} (${value})`}</Fact>
);

const CpuSection = ({ ctx, info }: SectionProps) => {
  const t = useT();
  const cpu = info.snapshot.cpu;
  return (
    <FactSection
      title={t("panels.helpers.heading.z80Registers")}
      expanded={ctx.viewState?.cpuExpanded ?? true}
      onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.cpuExpanded = exp))}
    >
      <FactCells cellWidth={REG_CELL_WIDTH} labelWidth={REG_LABEL_WIDTH}>
        <Register label="AF:" value={cpu.af} />
        <Register label="BC:" value={cpu.bc} />
        <Register label="DE:" value={cpu.de} />
        <Register label="HL:" value={cpu.hl} />
        <Register label="AF':" value={cpu.af_} />
        <Register label="BC':" value={cpu.bc_} />
        <Register label="DE':" value={cpu.de_} />
        <Register label="HL':" value={cpu.hl_} />
        <Register label="IX:" value={cpu.ix} />
        <Register label="IY:" value={cpu.iy} />
        <Register label="PC:" value={cpu.pc} />
        <Register label="SP:" value={cpu.sp} />
        <Fact label="I:" tone="state">{`$${toHexa2(cpu.i)}`}</Fact>
        <Fact label="R:" tone="state">{`$${toHexa2(cpu.r)}`}</Fact>
        <Fact label="IM:" tone="state">{`${cpu.im}`}</Fact>
        <FactFlag label="IFF1:" tone="state" value={cpu.iff1} />
        <FactFlag label="IFF2:" tone="state" value={cpu.iff2} />
      </FactCells>
    </FactSection>
  );
};

const BlinkSection = ({ ctx, info }: SectionProps) => {
  const t = useT();
  const blink = info.snapshot.blink;
  const bits: [Z88BlinkBitRegister, number][] = [
    ["COM", blink.com],
    ["INT", blink.int],
    ["STA", blink.sta],
    ["TMK", blink.tmk],
    ["TSTA", blink.tsta]
  ];
  return (
    <FactSection
      title="Blink"
      expanded={ctx.viewState?.blinkExpanded ?? true}
      onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.blinkExpanded = exp))}
    >
      <Facts labelWidth={REG_LABEL_WIDTH}>
        {bits.map(([name, value]) => (
          <Fact key={name} label={`${name}:`} tone="state">
            {`$${toHexa2(value)} (${z88BlinkBitNames(name, value)})`}
          </Fact>
        ))}
        <Fact label="SBF:" tone="state">
          {`$${toHexa4(blink.sbf)} (${formatZ88Ext24(z88SbfAddress(blink.sbf).ext24)})`}
        </Fact>
        <Fact label="LCD:" tone="state">
          {t("panels.z88.lcdSize", { width: blink.scw * 8, height: blink.sch * 8 })}
        </Fact>
      </Facts>
      <FactCells cellWidth={BYTE_CELL_WIDTH} labelWidth={TIM_LABEL_WIDTH}>
        {blink.sr.map((bank, index) => (
          <Fact key={`sr${index}`} label={`SR${index}:`} tone="state">{`$${toHexa2(bank)}`}</Fact>
        ))}
        {blink.tim.map((value, index) => (
          <Fact key={`tim${index}`} label={`TIM${index}:`} tone="state">{`$${toHexa2(value)}`}</Fact>
        ))}
      </FactCells>
      <FactCells cellWidth={PB_CELL_WIDTH} labelWidth={REG_LABEL_WIDTH}>
        {blink.pb.map((value, index) => (
          <Fact key={index} label={`PB${index}:`} tone="state">
            {`$${toHexa4(value)} (${formatZ88Ext24(PB_DECODERS[index](value).ext24)})`}
          </Fact>
        ))}
      </FactCells>
    </FactSection>
  );
};

const PagingSection = ({ ctx, info, documentSource }: SectionProps & { documentSource: string }) => {
  const t = useT();
  const documentHubService = useDocumentHubService();
  const { snapshot } = info;
  const pc = snapshot.cpu.pc;
  const space = useMemo(
    () => buildZ88AddressSpace(z88SnapshotBankReader(snapshot), snapshot.blink.sr, snapshot.blink.com),
    [snapshot]
  );
  const location = z88AddressLocation(snapshot, pc);

  const openAtPc = (viewMode: "memory" | "disassembly") =>
    openStaticMemoryDump(
      documentHubService,
      `z88Snapshot${documentSource}`,
      t("panels.helpers.addressSpaceTitle", { source: documentSource }),
      space,
      { disassemblyEnabled: true, disassOffset: 0, viewMode, topAddress: pc, disassemblyFlavor: "z88" }
    );

  return (
    <FactSection
      title={t("panels.z88.addressSpaceHeading")}
      actions={
        <>
          <SmallIconButton
            iconName="memory-icon"
            title={t("panels.helpers.memoryAtPc")}
            clicked={() => openAtPc("memory")}
          />
          <SmallIconButton
            iconName="disassembly-icon"
            title={t("panels.helpers.disassemblyAtPc")}
            clicked={() => openAtPc("disassembly")}
          />
        </>
      }
      expanded={ctx.viewState?.pagingExpanded ?? true}
      onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.pagingExpanded = exp))}
    >
      <Facts labelWidth={LABEL_WIDTH}>
        <Fact label="PC:" tone="state">
          {t("panels.spectrum.pcInBank", {
            pc: `$${toHexa4(pc)}`,
            bank: `$${toHexa2(location.bank)}`,
            offset: `$${toHexa4(location.offset)}`
          })}
        </Fact>
        {z88PagedRanges(snapshot).map((range) => (
          <Fact key={range.start} label={`$${toHexa4(range.start)}-$${toHexa4(range.end)}:`} tone="state">
            {
              // --- SR0 shows half a bank: bit 0 of the bank number picks the half
              range.start === 0x2000
                ? t(range.offset ? "panels.z88.rangeUpper" : "panels.z88.rangeLower", {
                    bank: `$${toHexa2(range.bank)}`,
                    owner: range.owner
                  })
                : t("panels.z88.range", { bank: `$${toHexa2(range.bank)}`, owner: range.owner })
            }
          </Fact>
        ))}
      </Facts>
    </FactSection>
  );
};

/**
 * Every card's banks in one browser. A bank pops out as its own document, keyed by the file's full
 * path (`z88BankDocument.ts`), disassembled as Z88 code where the snapshot pages it.
 */
const SlotsSection = ({ ctx, info, fullPath }: SectionProps & { fullPath: string }) => {
  const documentHubService = useDocumentHubService();
  const { navigationHistoryService } = useAppServices();
  const projectFolder = useSelector((s) => s.project?.folderPath);
  const bankView = ctx.viewState?.bankView;
  const cards = useMemo(() => z88ViewedCards(info), [info]);
  const items = useMemo(() => z88SlotBrowserItems(info, bankView), [info, bankView]);

  /** Pop a bank out in the view asked for. Recorded, so Go Back returns here. */
  const openBankDump = async (bank: number, view: Z88BankView) => {
    const item = items.find((i) => i.bank === bank);
    const bytes = cards.flatMap((card) => card.banks).find((b) => b.bank === bank)?.bytes;
    if (!item || !bytes) return;
    ctx.changeViewState((vs) => {
      vs.bankView = { ...vs.bankView, [bank]: view };
    });
    await navigationHistoryService.recordJump("z88Bank", () =>
      openStaticMemoryDump(
        documentHubService,
        z88BankDumpId(fullPath, bank),
        z88BankDumpTitle(fullPath, bank, projectFolder),
        bytes,
        {
          disassemblyEnabled: true,
          disassOffset: item.listedAt,
          viewMode: view,
          disassemblyFlavor: "z88"
        }
      )
    );
  };

  return (
    <Z88SlotBrowser
      items={items}
      cards={cards}
      selectedBank={ctx.viewState?.selectedBank}
      filter={ctx.viewState?.slotFilter ?? "all"}
      onSelect={(bank) => ctx.changeViewState((vs) => (vs.selectedBank = bank))}
      onFilterChange={(filter) => ctx.changeViewState((vs) => (vs.slotFilter = filter))}
      onPopOut={(bank, view) => void openBankDump(bank, view)}
    />
  );
};

const BreakpointsSection = ({ ctx, info }: SectionProps) => {
  const t = useT();
  const breakpoints = info.snapshot.breakpoints;
  return (
    <FactSection
      title={t("panels.z88.breakpointsHeading", { count: breakpoints.length })}
      expanded={ctx.viewState?.breakpointsExpanded ?? false}
      onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.breakpointsExpanded = exp))}
    >
      {breakpoints.length === 0 ? (
        <FactNote>{t("panels.z88.noBreakpoints")}</FactNote>
      ) : (
        <Facts labelWidth={LABEL_WIDTH}>
          {breakpoints.map((bp, index) => (
            <Fact key={index} label={`$${toHexa2(bp.bank)}:$${toHexa4(bp.offset)}`}>
              {bp.display ? t("panels.z88.bpDisplay") : t("panels.z88.bpStops")}
            </Fact>
          ))}
        </Facts>
      )}
    </FactSection>
  );
};
