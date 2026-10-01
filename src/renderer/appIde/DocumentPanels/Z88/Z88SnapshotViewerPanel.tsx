import { useEffect, useMemo, useState } from "react";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { ExpandableRow } from "@renderer/controls/layout/ExpandableRow";
import { LabeledText } from "@renderer/controls/layout/LabeledText";
import { LabeledFlag } from "@renderer/controls/layout/LabeledFlag";
import { Row } from "@renderer/controls/layout/Row";
import { Text } from "@renderer/controls/layout/Text";
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
 * The `.z88` (OZvm snapshot) viewer (`.plans/Z88_SNAPSHOT_PLAN.md` §4.8): what the file holds and
 * whether Klive can load it, the Z80 and Blink state, the 64K as the snapshot pages it (with a
 * memory dump and disassembly at PC), and every card bank by bank in the Slots browser
 * (`.plans/Z88_SLOT_BROWSER_PLAN.md`), which pops a bank out as its own document.
 *
 * Built only from the shared viewer primitives - no stylesheet of its own, no colour.
 */

/* --- M2: `ch`, not px */
const LABEL_WIDTH = "12ch";
const REG_LABEL_WIDTH = "5ch";
const REG_VALUE_WIDTH = "14ch";
const BLINK_VALUE_WIDTH = "30ch";

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
    return { error: `Invalid Z88 snapshot: ${err instanceof Error ? err.message : String(err)}` };
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
  const { snapshot, mapping } = info;
  const now = useMemo(() => Date.now(), []);
  const loadable = mapping.errors.length === 0;
  return (
    <ExpandableRow
      heading="Snapshot"
      initialExpanded={ctx.viewState?.summaryExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.summaryExpanded = exp))}
    >
      <Row>
        <LabeledFlag label="Loadable:" labelWidth={LABEL_WIDTH} value={loadable} />
        <LabeledFlag label="Autorun:" labelWidth={LABEL_WIDTH} value={snapshot.autorun} />
      </Row>
      {mapping.errors.map((error, index) => (
        <Row key={`error${index}`}>
          <Text text={error} variant="error" />
        </Row>
      ))}
      {[...snapshot.warnings, ...mapping.warnings].map((warning, index) => (
        <Row key={`warning${index}`}>
          <Text text={warning} variant="warning" />
        </Row>
      ))}
      <Row>
        <LabeledText
          label="Saved at:"
          labelWidth={LABEL_WIDTH}
          value={snapshot.stoppedAt !== undefined ? new Date(snapshot.stoppedAt).toLocaleString() : "not recorded"}
        />
      </Row>
      <Row>
        <LabeledText label="RTC saved:" labelWidth={LABEL_WIDTH} value={formatZ88Rtc(snapshot.blink.tim)} />
      </Row>
      <Row>
        <LabeledText
          label="RTC on load:"
          labelWidth={LABEL_WIDTH}
          value={formatZ88Rtc(adjustZ88LostTime(snapshot.blink.tim, snapshot.stoppedAt, now))}
          valueTooltip="The saved RTC advanced by the time the file has spent on disk"
        />
      </Row>
      {/* --- One entry per row: a data value never wraps, and the archive's members on one line
          --- pushed the whole viewer into horizontal scrolling */}
      {snapshot.entries.map((entry, index) => (
        <Row key={entry.name}>
          <LabeledText
            label={index === 0 ? "Contents:" : ""}
            labelWidth={LABEL_WIDTH}
            value={`${entry.name} (${entry.size} bytes)`}
          />
        </Row>
      ))}
      {snapshot.png && <LcdPicture png={snapshot.png} />}
    </ExpandableRow>
  );
};

/** The LCD picture OZvm saved; cosmetic, as in OZvm */
const LcdPicture = ({ png }: { png: Uint8Array }) => {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const created = URL.createObjectURL(new Blob([png.slice()], { type: "image/png" }));
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [png]);
  return url ? (
    <Row>
      <img
        src={url}
        alt="The LCD when the snapshot was saved"
        style={{ imageRendering: "pixelated", maxWidth: "100%" }}
      />
    </Row>
  ) : null;
};

const Register = ({ label, value }: { label: string; value: number }) => (
  <LabeledText
    label={label}
    labelWidth={REG_LABEL_WIDTH}
    value={`$${toHexa4(value)} (${value})`}
    valueWidth={REG_VALUE_WIDTH}
  />
);

const CpuSection = ({ ctx, info }: SectionProps) => {
  const cpu = info.snapshot.cpu;
  return (
    <ExpandableRow
      heading="Z80 Registers"
      initialExpanded={ctx.viewState?.cpuExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.cpuExpanded = exp))}
    >
      <Row>
        <Register label="AF:" value={cpu.af} />
        <Register label="BC:" value={cpu.bc} />
        <Register label="DE:" value={cpu.de} />
        <Register label="HL:" value={cpu.hl} />
        <Register label="PC:" value={cpu.pc} />
      </Row>
      <Row>
        <Register label="AF':" value={cpu.af_} />
        <Register label="BC':" value={cpu.bc_} />
        <Register label="DE':" value={cpu.de_} />
        <Register label="HL':" value={cpu.hl_} />
        <Register label="SP:" value={cpu.sp} />
      </Row>
      <Row>
        <Register label="IX:" value={cpu.ix} />
        <Register label="IY:" value={cpu.iy} />
        <LabeledText label="I:" labelWidth={REG_LABEL_WIDTH} value={`$${toHexa2(cpu.i)}`} valueWidth={REG_VALUE_WIDTH} />
        <LabeledText label="R:" labelWidth={REG_LABEL_WIDTH} value={`$${toHexa2(cpu.r)}`} valueWidth={REG_VALUE_WIDTH} />
        <LabeledText label="IM:" labelWidth={REG_LABEL_WIDTH} value={`${cpu.im}`} valueWidth={REG_VALUE_WIDTH} />
      </Row>
      <Row>
        <LabeledFlag label="IFF1:" labelWidth={REG_LABEL_WIDTH} value={cpu.iff1} />
        <LabeledFlag label="IFF2:" labelWidth={REG_LABEL_WIDTH} value={cpu.iff2} />
      </Row>
    </ExpandableRow>
  );
};

const BitRegister = ({ name, value }: { name: Z88BlinkBitRegister; value: number }) => (
  <Row>
    <LabeledText
      label={`${name}:`}
      labelWidth={REG_LABEL_WIDTH}
      value={`$${toHexa2(value)} (${z88BlinkBitNames(name, value)})`}
      valueWidth={BLINK_VALUE_WIDTH}
    />
  </Row>
);

const BlinkSection = ({ ctx, info }: SectionProps) => {
  const blink = info.snapshot.blink;
  return (
    <ExpandableRow
      heading="Blink"
      initialExpanded={ctx.viewState?.blinkExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.blinkExpanded = exp))}
    >
      <BitRegister name="COM" value={blink.com} />
      <BitRegister name="INT" value={blink.int} />
      <BitRegister name="STA" value={blink.sta} />
      <BitRegister name="TMK" value={blink.tmk} />
      <BitRegister name="TSTA" value={blink.tsta} />
      <Row>
        {blink.sr.map((bank, index) => (
          <LabeledText
            key={index}
            label={`SR${index}:`}
            labelWidth={REG_LABEL_WIDTH}
            value={`$${toHexa2(bank)}`}
            valueWidth="5ch"
          />
        ))}
      </Row>
      <Row>
        {blink.tim.map((value, index) => (
          <LabeledText
            key={index}
            label={`TIM${index}:`}
            labelWidth="6ch"
            value={`$${toHexa2(value)}`}
            valueWidth="5ch"
          />
        ))}
      </Row>
      <Row>
        {blink.pb.map((value, index) => (
          <LabeledText
            key={index}
            label={`PB${index}:`}
            labelWidth={REG_LABEL_WIDTH}
            value={`$${toHexa4(value)}`}
            valueWidth="7ch"
          />
        ))}
        <LabeledText label="SBR:" labelWidth={REG_LABEL_WIDTH} value={`$${toHexa4(blink.sbr)}`} valueWidth="7ch" />
      </Row>
      <Row>
        <LabeledText
          label="LCD:"
          labelWidth={REG_LABEL_WIDTH}
          value={`${blink.scw * 8} x ${blink.sch * 8} pixels`}
        />
      </Row>
    </ExpandableRow>
  );
};

const PagingSection = ({ ctx, info, documentSource }: SectionProps & { documentSource: string }) => {
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
      `${documentSource} - 64K at PC`,
      space,
      { disassemblyEnabled: true, disassOffset: 0, viewMode, topAddress: pc, disassemblyFlavor: "z88" }
    );

  return (
    <ExpandableRow
      heading="Address Space at PC"
      headingAction={
        <>
          <SmallIconButton
            iconName="memory-icon"
            title="Memory dump at PC"
            clicked={() => openAtPc("memory")}
          />
          <SmallIconButton
            iconName="disassembly-icon"
            title="Disassembly at PC"
            clicked={() => openAtPc("disassembly")}
          />
        </>
      }
      initialExpanded={ctx.viewState?.pagingExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.pagingExpanded = exp))}
    >
      <Row>
        <LabeledText
          label="PC:"
          labelWidth={LABEL_WIDTH}
          value={`$${toHexa4(pc)} = bank $${toHexa2(location.bank)}, offset $${toHexa4(location.offset)}`}
        />
      </Row>
      {z88PagedRanges(snapshot).map((range) => (
        <Row key={range.start}>
          <LabeledText
            label={`$${toHexa4(range.start)}-$${toHexa4(range.end)}:`}
            labelWidth={LABEL_WIDTH}
            value={
              `bank $${toHexa2(range.bank)} (${range.owner})` +
              // --- SR0 shows half a bank: bit 0 of the bank number picks the half
              (range.start === 0x2000 ? `, ${range.offset ? "upper" : "lower"} 8K` : "")
            }
          />
        </Row>
      ))}
    </ExpandableRow>
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
  const breakpoints = info.snapshot.breakpoints;
  return (
    <ExpandableRow
      heading={`Breakpoints (${breakpoints.length})`}
      initialExpanded={ctx.viewState?.breakpointsExpanded ?? false}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.breakpointsExpanded = exp))}
    >
      {breakpoints.length === 0 ? (
        <Row>
          <Text text="The snapshot has no breakpoints." />
        </Row>
      ) : (
        breakpoints.map((bp, index) => (
          <Row key={index}>
            <LabeledText
              label={`$${toHexa2(bp.bank)}:$${toHexa4(bp.offset)}`}
              labelWidth={LABEL_WIDTH}
              value={bp.display ? "display only" : "stops"}
            />
          </Row>
        ))
      )}
    </ExpandableRow>
  );
};
