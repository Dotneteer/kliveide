import { useCallback, useMemo } from "react";
import classnames from "classnames";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";
import { GenericFilePanel } from "../helpers/GenericFilePanel";
import {
  BankBrowser,
  BankChip,
  BankDetailsSection,
  BankFacts,
  BankGroupLabel,
  BankRowText,
  type BankBrowserItem
} from "@renderer/controls/bankBrowser/BankBrowser";
import { ByteAnatomy, type ByteAnatomyField } from "@renderer/controls/bankBrowser/ByteAnatomy";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";
import { MI_HT1080Z, MC_HT_MODEL } from "@common/machines/constants";
import { ht1080zCharsFor, type Ht1080zCharSetId } from "@common/machines/char-codes";
import type { CharDescriptor } from "@common/machines/info-types";
import { HT1080Z_PROGRAM_START } from "@common/ht1080z/codePlacement";
import { labelRecord } from "@common/i18n/labels";
import { t as translate } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import { documentSourceName } from "../helpers/documentSourceName";
import { formatPlayTime, type TapeSegmentTone, type TapeTimelineSegment } from "../Tape/tapeView";
import { TimelineStrip } from "../Tape/TimelineStrip";
import { openTapeBlockView } from "../Tape/TapeBlockViewerPanel";
import {
  analyzeHt1080zFile,
  fitsSixteenK,
  HT1080Z_TAPE_CLOCK,
  type Ht1080zPart,
  type Ht1080zTapeAnalysis
} from "./ht1080zTapeView";
import { ht1080zPartAnatomy } from "./ht1080zTapeFields";
import { ht1080zLineRuns, ht1080zLineText, relinkedProgram } from "./ht1080zLineText";
import { MemoryMapStrip, type MemoryMapBlock } from "./MemoryMapStrip";
import styles from "./Ht1080zTapeViewer.module.scss";

/*
 * The HT-1080Z tape file viewer (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D5): a `.cas`, a `.cmd` or a
 * tokenised `.bas`, shown the way the TAP/TZX viewer shows a Spectrum tape - a summary strip, a graphic
 * of the whole file, the parts in the shared bank browser and the selected part's facts and bytes.
 *
 * The graphics: a `.cas` plays, so it gets the timeline; whatever loads gets the memory map, so a block
 * past 7FFFh is seen to need a 48K model; a `.bas` gets a strip of its lines by size.
 *
 * Its listings follow the running HT model's character set (Series II when no HT runs), and the switch
 * beside a listing picks another for this document (D-Q2). A part pops out as a BASIC listing, as memory
 * or as a disassembly; the file's own bytes pop out from the summary (D-Q3: this viewer replaced the hex
 * viewer for these files).
 */

export type Ht1080zPartView = "basic" | "memory" | "disassembly";

type Ht1080zTapeViewState = {
  scrollPosition?: number;
  selectedPart?: number;
  partFilter?: string;
  /** The character set the user picked for this document's listings */
  charSet?: Ht1080zCharSetId;
  /** The view each part last popped out in */
  partView?: Record<number, Ht1080zPartView>;
};

/** What the loader keeps: the analysis, and the bytes for the file's own pop-out */
export type Ht1080zTapeFileInfo = { analysis: Ht1080zTapeAnalysis; bytes: Uint8Array };

type ViewContext = GenericFileContext<Ht1080zTapeFileInfo, Ht1080zTapeViewState>;

type PartItem = BankBrowserItem<Ht1080zPartView> & { part: Ht1080zPart };

/** The /64 runs a little faster than the Series I and II */
const HT64_CLOCK = 1_777_417;

const VIEW_NAMES: Readonly<Record<Ht1080zPartView, string>> = labelRecord({
  basic: "panels.helpers.view.basic",
  memory: "panels.helpers.view.memory",
  disassembly: "panels.helpers.view.disassembly"
});

const FORMAT_NAMES: Readonly<Record<Ht1080zTapeAnalysis["kind"], string>> = labelRecord({
  basicTape: "panels.htTape.format.basicTape",
  systemTape: "panels.htTape.format.systemTape",
  cmd: "panels.htTape.format.cmd",
  bas: "panels.htTape.format.bas"
});

const CHAR_SET_NAMES: Readonly<Record<Ht1080zCharSetId, string>> = labelRecord({
  s1: "panels.htTape.charSet.s1",
  s2: "panels.htTape.charSet.s2",
  s64: "panels.htTape.charSet.s64"
});

/** Parses an HT-1080Z tape file for the viewer */
export function loadHt1080zTapeContents(
  contents: Uint8Array,
  fileName: string,
  clock = HT1080Z_TAPE_CLOCK
): { fileInfo?: Ht1080zTapeFileInfo; error?: string } {
  const { analysis, error } = analyzeHt1080zFile(contents, fileName, clock);
  if (analysis) return { fileInfo: { analysis, bytes: contents } };
  switch (error) {
    case "noHeader":
      return { error: translate("panels.htTape.error.noHeader") };
    case "highSpeed":
      return { error: translate("panels.htTape.error.highSpeed") };
    case "notTokenised":
      return { error: translate("panels.htTape.error.notTokenised") };
    default:
      return { error: translate("panels.htTape.error.unknownFile") };
  }
}

/** The running HT model, when an HT runs */
function useRunningHtModel(): Ht1080zCharSetId | undefined {
  return useSelector((s) =>
    s.emulatorState?.machineId === MI_HT1080Z
      ? ((s.emulatorState?.config?.[MC_HT_MODEL] as Ht1080zCharSetId | undefined) ?? "s2")
      : undefined
  );
}

const Ht1080zTapeViewerPanel = ({ document, contents, viewState }: DocumentProps<Ht1080zTapeViewState>) => {
  const runningModel = useRunningHtModel();
  const fileName = document.node?.fullPath ?? document.path ?? document.name ?? document.id;
  const clock = runningModel === "s64" ? HT64_CLOCK : HT1080Z_TAPE_CLOCK;
  const fileLoader = useCallback(
    (bytes: Uint8Array) => loadHt1080zTapeContents(bytes, fileName, clock),
    [fileName, clock]
  );
  return (
    <GenericFilePanel<Ht1080zTapeFileInfo, Ht1080zTapeViewState>
      document={document}
      contents={contents}
      viewState={viewState}
      apiLoaded={() => {}}
      fileLoader={fileLoader}
      validRenderer={(ctx) => (
        <TapeView ctx={ctx} fullPath={fileName} runningModel={runningModel} />
      )}
    />
  );
};

export const createHt1080zTapeViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <Ht1080zTapeViewerPanel
    key={document.id}
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);

// =================================================================================================
// What a part is

/** The data a part loads, and where */
function loadedBytes(part: Ht1080zPart): Uint8Array | undefined {
  if (part.loadFrom === undefined || part.loadTo === undefined) return undefined;
  switch (part.role) {
    case "systemBlock":
    case "cmdLoad":
      return part.bytes.subarray(4, 4 + (part.loadTo - part.loadFrom));
    default:
      return part.bytes;
  }
}

const isProgramPart = (part: Ht1080zPart) =>
  part.role === "basicProgram" || part.role === "basLine" || (part.role === "programEnd" && !part.problem);
const isCodePart = (part: Ht1080zPart) => part.role === "systemBlock" || part.role === "cmdLoad";

function viewsOf(part: Ht1080zPart, analysis: Ht1080zTapeAnalysis): Ht1080zPartView[] {
  if (part.role === "leader" || part.role === "sync" || part.bytes.length === 0) return [];
  if (isProgramPart(part) && analysis.lines?.length) return ["basic", "memory"];
  if (isCodePart(part) && !part.problem) return ["disassembly", "memory"];
  return ["memory"];
}

function toneOf(part: Ht1080zPart): TapeSegmentTone {
  if (part.problem) return "unplayable";
  switch (part.role) {
    case "leader":
      return "tone";
    case "sync":
      return "pause";
    case "basicHeader":
    case "systemHeader":
    case "cmdHeader":
      return "header";
    case "basicProgram":
    case "basLine":
      return "basic";
    case "systemBlock":
    case "cmdLoad":
      return "code";
    default:
      return "data";
  }
}

const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");
const hex4 = (value: number) => `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
/* --- Byte counts sit beside hex as data: invariant */
const fmt = (value: number) => value.toLocaleString("en-US");
const span = (from: number, to: number) => `${hex4(from)}–${hex4(to - 1)}`;

/** The chip a part's row starts with */
function chipOf(part: Ht1080zPart): string {
  switch (part.role) {
    case "leader":
      return translate("panels.htTape.chip.leader");
    case "sync":
      return translate("panels.htTape.chip.sync");
    case "basicHeader":
    case "systemHeader":
      return translate("panels.htTape.chip.header");
    case "basicProgram":
      return translate("panels.helpers.view.basic");
    case "programEnd":
      return translate("panels.htTape.chip.end");
    case "systemBlock":
      return translate("panels.htTape.chip.code");
    case "systemEntry":
      return translate("panels.htTape.chip.entry");
    case "cmdHeader":
      return translate("panels.htTape.chip.cmdName");
    case "cmdLoad":
      return translate("panels.htTape.chip.cmdLoad");
    case "cmdTransfer":
      return translate("panels.htTape.chip.cmdStart");
    case "cmdOther":
      return translate("panels.htTape.chip.cmdOther", { type: hex2(part.recordType ?? 0) });
    case "basLine":
      return `${part.line?.lineNo ?? ""}`;
    default:
      return translate("panels.htTape.chip.trailing");
  }
}

/** The short text a part's row shows */
function rowTextOf(part: Ht1080zPart, analysis: Ht1080zTapeAnalysis, charSet: Record<number, CharDescriptor>, s64: boolean): string {
  const lines = analysis.lines ?? [];
  switch (part.role) {
    case "leader":
      return `${fmt(part.bytes.length)} × 00`;
    case "sync":
      return "A5";
    // --- CLOAD and SYSTEM are the commands that load the file: not translated
    case "basicHeader":
      return `CLOAD "${part.name ?? ""}"`;
    case "systemHeader":
      return `SYSTEM "${part.name ?? ""}"`;
    case "basicProgram":
      return lines.length
        ? translate("panels.htTape.row.lines", { count: lines.length, first: lines[0].lineNo, last: lines[lines.length - 1].lineNo })
        : "";
    case "programEnd":
      return "00 00";
    case "systemBlock":
    case "cmdLoad":
      return part.loadFrom !== undefined && part.loadTo !== undefined ? span(part.loadFrom, part.loadTo) : "";
    case "systemEntry":
    case "cmdTransfer":
      return part.entry !== undefined ? hex4(part.entry) : "";
    case "cmdHeader":
      return `"${part.name ?? ""}"`;
    case "basLine":
      return part.line ? ht1080zLineText(part.line.text, charSet, s64) : "";
    default:
      return translate("panels.helpers.bytes", { count: part.bytes.length });
  }
}

function problemText(part: Ht1080zPart): string | undefined {
  switch (part.problem) {
    case "truncated":
      return translate("panels.htTape.problem.truncated");
    case "checksum":
      return translate("panels.htTape.problem.checksum");
    case "badRecord":
      return translate("panels.htTape.problem.badRecord");
    default:
      return undefined;
  }
}

/** The part selected when the document opens: what the file is for */
function initialPart(analysis: Ht1080zTapeAnalysis): number {
  const main = analysis.parts.find((p) => isCodePart(p) || p.role === "basicProgram" || p.role === "basLine");
  return main?.index ?? 0;
}

// =================================================================================================
// The view

/** A module-level component, so it may hold hooks (see `GenericFilePanel`'s renderer note) */
const TapeView = ({
  ctx,
  fullPath,
  runningModel
}: {
  ctx: ViewContext;
  fullPath: string;
  runningModel?: Ht1080zCharSetId;
}) => {
  const t = useT();
  const documentHubService = useDocumentHubService();
  const { navigationHistoryService } = useAppServices();
  const projectFolder = useSelector((s) => s.project?.folderPath);
  const info = ctx.fileInfo;
  const vs = ctx.viewState ?? {};
  const charSetId: Ht1080zCharSetId = vs.charSet ?? runningModel ?? "s2";
  const charSet = useMemo(() => ht1080zCharsFor(charSetId), [charSetId]);
  const analysis = info?.analysis;

  const items = useMemo<PartItem[]>(
    () =>
      (analysis?.parts ?? []).map((part) => {
        const views = viewsOf(part, analysis!);
        const remembered = vs.partView?.[part.index];
        return {
          key: `${part.index}`,
          bank: part.index,
          lastView: remembered && views.includes(remembered) ? remembered : (views[0] ?? "memory"),
          part
        };
      }),
    [analysis, vs.partView]
  );
  if (!info || !analysis) return null;

  const selected = vs.selectedPart ?? initialPart(analysis);
  const select = (index: number) => ctx.changeViewState((state) => (state.selectedPart = index));
  const source = documentSourceName(fullPath, projectFolder);

  /** Pop a part out in the view asked for. Recorded, so Go Back returns here. */
  const popOut = async (index: number, view: Ht1080zPartView) => {
    const part = analysis.parts[index];
    if (!part) return;
    ctx.changeViewState((state) => {
      state.partView = { ...state.partView, [index]: view };
    });
    if (view === "basic" && analysis.lines?.length) {
      const program = relinkedProgram(analysis.lines);
      await navigationHistoryService.recordJump("tapeBlock", () =>
        openTapeBlockView(documentHubService, {
          id: `htTapeBasic${fullPath}`,
          title: t("panels.htTape.title.basic", { source }),
          bytes: program,
          view: "basic",
          basicEnd: program.length,
          format: "ht1080z",
          htCharSet: charSetId
        })
      );
      return;
    }
    // --- A program part pops out as the whole program at 42E9h; code as what it loads, where
    const program = isProgramPart(part) && analysis.lines?.length ? relinkedProgram(analysis.lines) : undefined;
    const bytes = program ?? loadedBytes(part) ?? part.bytes;
    const at = program ? HT1080Z_PROGRAM_START : (part.loadFrom ?? 0);
    await navigationHistoryService.recordJump("tapeBlock", () =>
      openStaticMemoryDump(
        documentHubService,
        program ? `htTapeProgram${fullPath}` : `htTapePart${fullPath}:${index}`,
        program ? t("panels.htTape.title.program", { source }) : t("panels.htTape.title.part", { source, index }),
        bytes,
        {
          disassemblyEnabled: true,
          disassOffset: at,
          viewMode: view === "disassembly" ? "disassembly" : "memory",
          disassemblyFlavor: "ht1080z"
        }
      )
    );
  };

  const popOutFile = () =>
    navigationHistoryService.recordJump("tapeBlock", () =>
      openStaticMemoryDump(documentHubService, `htTapeFile${fullPath}`, t("panels.htTape.title.file", { source }), info.bytes, {
        disassemblyEnabled: false,
        viewMode: "memory"
      })
    );

  const setCharSet = (id: Ht1080zCharSetId) => ctx.changeViewState((state) => (state.charSet = id));
  const s64 = charSetId === "s64";

  return (
    <div className={styles.viewer}>
      <Summary
        analysis={analysis}
        onPopOutFile={() => void popOutFile()}
        onShowEntry={(index) =>
          ctx.changeViewState((state) => {
            state.selectedPart = index;
            // --- The entry loads nothing, so a filter may hide it
            if (state.partFilter && state.partFilter !== "all") state.partFilter = "all";
          })
        }
      />
      {analysis.hasProblems && (
        <div className={styles.banner} role="note">
          {t("panels.htTape.problemBanner")}
        </div>
      )}
      <BankBrowser<PartItem, Ht1080zPartView>
        visibleItems={filterParts(items, vs.partFilter ?? "all")}
        selectedKey={`${selected}`}
        heading={t(analysis.kind === "cmd" ? "panels.htTape.heading.records" : analysis.kind === "bas" ? "panels.htTape.heading.lines" : "panels.htTape.heading.parts")}
        summary={t("panels.htTape.listSummary", {
          kind: analysis.kind === "cmd" ? "records" : analysis.kind === "bas" ? "lines" : "parts",
          count: analysis.kind === "bas" ? (analysis.lines?.length ?? 0) : analysis.parts.length
        })}
        filters={[
          { value: "all", text: t("panels.helpers.filter.all") },
          { value: "loads", text: t("panels.htTape.filter.loads") },
          { value: "problems", text: t("panels.htTape.filter.problems") }
        ]}
        filter={vs.partFilter ?? "all"}
        views={["basic", "disassembly", "memory"]}
        viewNames={VIEW_NAMES}
        itemKind="part"
        layout="sideBySide"
        fill
        formatNumber={(item) => `#${item.bank}`}
        viewsFor={(item) => viewsOf(item.part, analysis)}
        onSelect={(item) => select(item.part.index)}
        onFilterChange={(filter) => ctx.changeViewState((state) => (state.partFilter = filter))}
        onPopOut={(item, view) => void popOut(item.part.index, view)}
        beforeBody={<Graphics analysis={analysis} selected={selected} onSelect={select} />}
        groupOf={() => ({
          key: "file",
          label: <BankGroupLabel title={groupTitle(analysis, source)} />
        })}
        renderRow={(item) => (
          <>
            <BankChip tone={item.part.problem ? "error" : undefined} alt={toneOf(item.part) === "header"}>
              {chipOf(item.part)}
            </BankChip>
            <BankRowText title={rowTextOf(item.part, analysis, charSet, s64)}>
              {rowTextOf(item.part, analysis, charSet, s64)}
            </BankRowText>
            <span className={styles.rowLength}>{fmt(item.part.bytes.length)}</span>
          </>
        )}
        renderDetailsMarks={(item) => (
          <>
            <BankChip alt={toneOf(item.part) === "header"}>{chipOf(item.part)}</BankChip>
            {item.part.problem && <BankChip tone="error">{t("panels.htTape.chip.problem")}</BankChip>}
          </>
        )}
        renderDetails={(item) => (
          <Details
            key={item.part.index}
            analysis={analysis}
            part={item.part}
            charSet={charSet}
            charSetId={charSetId}
            onCharSet={setCharSet}
            onShowAll={() => void popOut(item.part.index, "basic")}
          />
        )}
        hint={t("panels.helpers.popOutHint.part")}
      />
    </div>
  );
};

function filterParts(items: PartItem[], filter: string): PartItem[] {
  switch (filter) {
    case "loads":
      return items.filter((i) => i.part.loadFrom !== undefined);
    case "problems":
      return items.filter((i) => !!i.part.problem);
    default:
      return items;
  }
}

function groupTitle(analysis: Ht1080zTapeAnalysis, source: string): string {
  const name = analysis.name ?? "";
  switch (analysis.kind) {
    case "basicTape":
      return translate("panels.htTape.group.basicTape", { name });
    case "systemTape":
      return translate("panels.htTape.group.systemTape", { name });
    case "cmd":
      return name ? translate("panels.htTape.group.cmd", { name }) : translate("panels.htTape.group.cmdNoName");
    default:
      return translate("panels.htTape.group.bas", { name: source.replace(/^.*[\\/]/, "") });
  }
}

// =================================================================================================
// The summary

const Fact = ({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warning" }) => (
  <span className={styles.fact}>
    <span className={styles.factLabel}>{label}</span>
    <span className={classnames(styles.factValue, tone && styles[tone])}>{value}</span>
  </span>
);

type SummaryProps = {
  analysis: Ht1080zTapeAnalysis;
  onPopOutFile: () => void;
  /** Selects the part that holds the start address */
  onShowEntry: (index: number) => void;
};

const Summary = ({ analysis, onPopOutFile, onShowEntry }: SummaryProps) => {
  const t = useT();
  const lines = analysis.lines ?? [];
  const blocks = analysis.parts.filter(isCodePart).length;
  const loads = analysis.loadTop !== undefined;
  const fits = fitsSixteenK(analysis);
  const programBytes = lines.reduce((sum, l) => sum + l.length, 0);
  // --- The ENTRY record of a SYSTEM tape, the 02 (transfer) record of a .cmd
  const entryPart = analysis.parts.find((p) => p.role === "systemEntry" || p.role === "cmdTransfer");
  return (
    <div className={styles.summary} aria-label={t("panels.htTape.summaryLabel")}>
      <Fact label={t("panels.tape.fact.format")} value={FORMAT_NAMES[analysis.kind]} />
      <Fact label={t("panels.tape.fact.size")} value={t("panels.helpers.bytes", { count: analysis.size })} />
      {analysis.name && <Fact label={t("panels.htTape.fact.name")} value={`"${analysis.name}"`} />}
      {lines.length > 0 && (
        <Fact
          label={t("panels.htTape.fact.program")}
          value={t("panels.htTape.fact.programValue", {
            count: lines.length,
            first: lines[0].lineNo,
            last: lines[lines.length - 1].lineNo,
            bytes: fmt(programBytes)
          })}
        />
      )}
      {analysis.codeBytes !== undefined && blocks > 0 && (
        <Fact label={t("panels.htTape.fact.code")} value={t("panels.htTape.fact.codeValue", { count: blocks, bytes: fmt(analysis.codeBytes) })} />
      )}
      {analysis.entry !== undefined && (
        <span className={styles.fact}>
          <span className={styles.factLabel}>{t("panels.htTape.fact.start")}</span>
          {entryPart ? (
            <button
              type="button"
              className={styles.factLink}
              title={t("panels.htTape.showEntry", { index: entryPart.index })}
              onClick={() => onShowEntry(entryPart.index)}
            >
              {hex4(analysis.entry)}
            </button>
          ) : (
            <span className={styles.factValue}>{hex4(analysis.entry)}</span>
          )}
        </span>
      )}
      <Fact
        label={analysis.kind === "basicTape" || analysis.kind === "systemTape" ? t("panels.tape.fact.playTime") : t("panels.htTape.fact.asTape")}
        value={formatPlayTime(analysis.playMs)}
      />
      {loads && (
        <Fact
          label={t("panels.htTape.fact.fits")}
          value={fits ? t("panels.htTape.fits.all") : t("panels.htTape.fits.48k")}
          tone={fits ? "ok" : "warning"}
        />
      )}
      <button type="button" className={styles.more} onClick={onPopOutFile}>
        {t("panels.htTape.popOutFile")}
      </button>
    </div>
  );
};

// =================================================================================================
// The graphics

const Graphics = ({
  analysis,
  selected,
  onSelect
}: {
  analysis: Ht1080zTapeAnalysis;
  selected: number;
  onSelect: (index: number) => void;
}) => {
  const t = useT();
  const parts = analysis.parts;
  const played = analysis.kind === "basicTape" || analysis.kind === "systemTape";

  const timeline = useMemo(
    () =>
      played
        ? parts.map((p) => ({ index: p.index, ms: Math.max(0, (p.endMs ?? 0) - (p.startMs ?? 0)), tone: toneOf(p) }))
        : [],
    [parts, played]
  );
  const lineStrip = useMemo(
    () =>
      analysis.kind === "bas"
        ? parts.filter((p) => p.role === "basLine").map((p) => ({ index: p.index, ms: p.bytes.length, tone: toneOf(p) }))
        : [],
    [parts, analysis.kind]
  );
  const blocks = useMemo<MemoryMapBlock[]>(
    () =>
      parts
        .filter((p) => p.loadFrom !== undefined && p.loadTo !== undefined)
        .map((p) => ({
          index: p.index,
          from: p.loadFrom!,
          to: p.loadTo!,
          kind: isCodePart(p) ? "code" : "basic",
          title: `#${p.index} · ${span(p.loadFrom!, p.loadTo!)}`
        })),
    [parts]
  );

  const timelineTooltip = (segment: TapeTimelineSegment) => {
    const first = parts[segment.first];
    const last = parts[segment.last];
    return `#${first.index} · ${chipOf(first)} · ${formatPlayTime(first.startMs ?? 0)}–${formatPlayTime(last.endMs ?? 0)}`;
  };
  const lineTooltip = (segment: TapeTimelineSegment) => {
    const part = parts[segment.first];
    return t("panels.htTape.strip.lineTooltip", { line: part.line?.lineNo ?? 0, count: part.bytes.length });
  };
  const programEnd = HT1080Z_PROGRAM_START + (analysis.lines ?? []).reduce((sum, l) => sum + l.length, 0);

  return (
    <div className={styles.graphics}>
      {timeline.length > 0 && (
        <div className={styles.graphic}>
          <TimelineStrip items={timeline} selectedIndex={selected} onSelect={onSelect} tooltip={timelineTooltip} testId="ht-timeline" />
          <div className={styles.caption} aria-hidden="true">
            <span>0:00</span>
            <span>{t("panels.htTape.strip.timeline")}</span>
            <span>{formatPlayTime(analysis.playMs)}</span>
          </div>
        </div>
      )}
      {blocks.length > 0 && <MemoryMapStrip blocks={blocks} selectedIndex={selected} onSelect={onSelect} />}
      {lineStrip.length > 0 && (
        <div className={styles.graphic}>
          <TimelineStrip items={lineStrip} selectedIndex={selected} onSelect={onSelect} tooltip={lineTooltip} testId="ht-line-strip" />
          <div className={styles.caption} aria-hidden="true">
            <span>{hex4(HT1080Z_PROGRAM_START)}</span>
            <span>{t("panels.htTape.strip.lines")}</span>
            <span>{hex4(programEnd - 1)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// =================================================================================================
// The details

const CHAR_SETS: Ht1080zCharSetId[] = ["s1", "s2", "s64"];

const CharSetSwitch = ({ value, onChange }: { value: Ht1080zCharSetId; onChange: (id: Ht1080zCharSetId) => void }) => {
  const t = useT();
  return (
    <span className={styles.charSets} role="group" aria-label={t("panels.htTape.fact.characters")}>
      {CHAR_SETS.map((id) => (
        <button
          key={id}
          type="button"
          className={classnames(styles.charSet, { [styles.on]: id === value })}
          aria-pressed={id === value}
          onClick={() => onChange(id)}
        >
          {CHAR_SET_NAMES[id]}
        </button>
      ))}
    </span>
  );
};

/** One listing line: the number, then the text in keyword, string and plain runs */
const ListingLine = ({ lineNo, text, charSet, s64 }: { lineNo: number; text: Uint8Array; charSet: Record<number, CharDescriptor>; s64: boolean }) => (
  <div className={styles.listingLine}>
    <span className={styles.lineNo}>{lineNo}</span>{" "}
    {ht1080zLineRuns(text, charSet, s64).map((run, i) => (
      <span key={i} className={run.kind === "keyword" ? styles.keyword : run.kind === "string" ? styles.string : undefined}>
        {run.text}
      </span>
    ))}
  </div>
);

type DetailsProps = {
  analysis: Ht1080zTapeAnalysis;
  part: Ht1080zPart;
  charSet: Record<number, CharDescriptor>;
  charSetId: Ht1080zCharSetId;
  onCharSet: (id: Ht1080zCharSetId) => void;
  onShowAll: () => void;
};

const Details = ({ analysis, part, charSet, charSetId, onCharSet, onShowAll }: DetailsProps) => {
  const t = useT();
  // --- `t` changes with the language, so the fields are worded again
  const anatomy = useMemo(
    () => ht1080zPartAnatomy(part, charSet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [part, charSet, t]
  );
  const fields = useMemo<ByteAnatomyField[] | undefined>(
    () =>
      anatomy?.fields.map((field) => {
        const group = anatomy.groups[field.group];
        return {
          key: `${field.group}`,
          first: group.first,
          last: group.last,
          name: field.name,
          value: field.value,
          kind: group.kind
        };
      }),
    [anatomy]
  );
  const s64 = charSetId === "s64";
  const played = part.startMs !== undefined && part.endMs !== undefined;
  const problem = problemText(part);
  const lines = analysis.lines ?? [];

  return (
    <>
      <BankFacts>
        <dt>{t("panels.helpers.fact.length")}</dt>
        <dd>{t("panels.helpers.bytes", { count: part.bytes.length })}</dd>
        {played && (
          <>
            <dt>{t("panels.tape.fact.plays")}</dt>
            <dd>{`${formatPlayTime(part.startMs!)}–${formatPlayTime(part.endMs!)}`}</dd>
          </>
        )}
        {part.role === "leader" && (
          <>
            <dt>{t("panels.tape.fact.holds")}</dt>
            <dd>{t("panels.htTape.detail.leader")}</dd>
          </>
        )}
        {part.recordType !== undefined && (
          <>
            <dt>{t("panels.htTape.fact.record")}</dt>
            <dd>{`${hex2(part.recordType)}h`}</dd>
          </>
        )}
        {part.role === "basicProgram" && (
          <>
            <dt>{t("panels.tape.fact.loadsAt")}</dt>
            <dd>{t("panels.htTape.detail.programAt", { address: hex4(HT1080Z_PROGRAM_START) })}</dd>
          </>
        )}
        {part.role === "basLine" && part.loadFrom !== undefined && part.loadTo !== undefined && (
          <>
            <dt>{t("panels.htTape.fact.at")}</dt>
            <dd>{t("panels.htTape.detail.lineAt", { span: span(part.loadFrom, part.loadTo) })}</dd>
          </>
        )}
        {isCodePart(part) && part.loadFrom !== undefined && part.loadTo !== undefined && (
          <>
            <dt>{t("panels.htTape.fact.loads")}</dt>
            <dd>{t("panels.htTape.detail.loads", { span: span(part.loadFrom, part.loadTo), count: part.loadTo - part.loadFrom })}</dd>
            <dt>{t("panels.htTape.fact.fits")}</dt>
            <dd className={part.loadTo <= 0x8000 ? styles.ok : styles.warning}>
              {part.loadTo <= 0x8000 ? t("panels.htTape.detail.fitsAll") : t("panels.htTape.detail.fits48k")}
            </dd>
          </>
        )}
        {part.checksum && (
          <>
            <dt>{t("panels.tape.fact.checksum")}</dt>
            <dd className={part.checksum.stored === part.checksum.computed ? styles.ok : styles.error}>
              {part.checksum.stored === part.checksum.computed ? t("panels.tape.fact.checksumOk") : t("panels.tape.fact.checksumBad")}
            </dd>
          </>
        )}
        {part.entry !== undefined && (
          <>
            <dt>{t("panels.htTape.fact.start")}</dt>
            <dd>{hex4(part.entry)}</dd>
          </>
        )}
        {problem && (
          <>
            <dt>{t("panels.htTape.fact.problem")}</dt>
            <dd className={styles.error}>{problem}</dd>
          </>
        )}
        {(part.role === "basicProgram" || part.role === "basLine") && (
          <>
            <dt>{t("panels.htTape.fact.characters")}</dt>
            <dd>
              <CharSetSwitch value={charSetId} onChange={onCharSet} />
            </dd>
          </>
        )}
      </BankFacts>

      {part.role === "sync" && <p className={styles.hint}>{t("panels.htTape.detail.sync")}</p>}

      {part.role === "basicProgram" && lines.length > 0 && (
        <BankDetailsSection title={t("panels.helpers.view.basic")}>
          {/* --- A Level II program is a few hundred bytes: listed here in full; the details pane scrolls */}
          <div className={styles.listing} data-testid="ht-tape-listing">
            {lines.map((line) => (
              <ListingLine key={line.offset} lineNo={line.lineNo} text={line.text} charSet={charSet} s64={s64} />
            ))}
          </div>
          <button type="button" className={styles.more} onClick={onShowAll}>
            {t("panels.helpers.popOutListing")}
          </button>
        </BankDetailsSection>
      )}

      {part.role === "basLine" && part.line && (
        <div className={styles.listing} data-testid="ht-tape-listing">
          <ListingLine lineNo={part.line.lineNo} text={part.line.text} charSet={charSet} s64={s64} />
        </div>
      )}

      {fields && fields.length > 0 && (
        <ByteAnatomy
          key={`${part.index}:${charSetId}`}
          title={t(part.role === "basLine" ? "panels.htTape.section.lineBytes" : "panels.htTape.section.bytes")}
          bytes={part.bytes}
          fields={fields}
          testId="ht-tape-bytes"
        />
      )}

      {part.role === "basLine" && <p className={styles.hint}>{t("panels.htTape.detail.lineHint")}</p>}
      {analysis.kind === "cmd" && isCodePart(part) && <p className={styles.hint}>{t("panels.htTape.detail.cmdHint")}</p>}
    </>
  );
};
