import { useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";
import { t as translate } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { ExpandableRow } from "@renderer/controls/layout/ExpandableRow";
import { LabeledText } from "@renderer/controls/layout/LabeledText";
import { Row } from "@renderer/controls/layout/Row";
import { Text } from "@renderer/controls/layout/Text";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { DataLabel, DataRow, DataSecondary, DataValue, formatHex } from "@renderer/controls/data";
import { disassemblyText } from "@renderer/controls/data/DisassemblyText";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { TimelineStrip } from "../Tape/TimelineStrip";
import type { TapeSegmentTone, TimelineItem } from "../Tape/tapeView";
import { rgb333Rgb } from "@common/zxnext/layers/layerMix";
import {
  FW_BLOCK,
  FW_MAP_CAPACITY,
  FW_TEST_CARD_HEIGHT,
  FW_TEST_CARD_WIDTH,
  fwModuleTexts,
  parseFwFile,
  readFwTestCard,
  type FwEntry,
  type FwFile,
  type FwModuleName,
  type FwProblem
} from "@common/zxnext/fwFile";
import styles from "./FwFileViewerPanel.module.scss";

/*
 * The `TBBLUE.FW` viewer (`dev/plans/TBBLUE_FW_VIEWER_PLAN.md`, layout A, D7): the file, its module map
 * and table, the selected module's details and texts, and its content: the start of its disassembly at
 * $6000 (the whole module opens in the static memory dump), or the test card picture of the screens
 * block. Read-only; everything comes from `parseFwFile`.
 */

/* --- M2: `ch`, not px */
const LABEL_WIDTH = "14ch";

/** Instructions listed in the viewer; the whole module is one click away in the memory dump */
const LISTING_LIMIT = 256;

/** Texts listed in a module's details */
const TEXT_LIMIT = 12;

type FwViewState = {
  scrollPosition?: number;
  fileExpanded?: boolean;
  modulesExpanded?: boolean;
  detailsExpanded?: boolean;
  contentExpanded?: boolean;
  /** The selected entry's index */
  selected?: number;
};

type FwFileInfo = { file: FwFile; data: Uint8Array };

type ViewContext = GenericFileContext<FwFileInfo, FwViewState>;

// ---------------------------------------------------------------------------------------------
// Texts: keys at definition, text at display
// ---------------------------------------------------------------------------------------------

const PROBLEM_KEYS: Record<FwProblem["code"], MessageKey> = {
  tooShort: "panels.next.fw.problem.tooShort",
  notFirmware: "panels.next.fw.problem.notFirmware",
  notBlockAligned: "panels.next.fw.problem.notBlockAligned",
  trailingData: "panels.next.fw.problem.trailingData",
  entryOutOfRange: "panels.next.fw.problem.entryOutOfRange",
  entryOverlap: "panels.next.fw.problem.entryOverlap",
  noUpdater: "panels.next.fw.problem.noUpdater"
};

const NAME_KEYS: Record<FwModuleName, MessageKey> = {
  boot: "panels.next.fw.module.boot",
  editorOld: "panels.next.fw.module.editorOld",
  updater: "panels.next.fw.module.updater",
  coresOld: "panels.next.fw.module.coresOld",
  editor: "panels.next.fw.module.editor",
  cores: "panels.next.fw.module.cores",
  testCard: "panels.next.fw.module.testCard",
  reset: "panels.next.fw.module.reset",
  screens: "panels.next.fw.module.screens"
};

const WHAT_KEYS: Record<FwModuleName, MessageKey> = {
  boot: "panels.next.fw.what.boot",
  editorOld: "panels.next.fw.what.editorOld",
  updater: "panels.next.fw.what.updater",
  coresOld: "panels.next.fw.what.coresOld",
  editor: "panels.next.fw.what.editor",
  cores: "panels.next.fw.what.cores",
  testCard: "panels.next.fw.what.testCard",
  reset: "panels.next.fw.what.reset",
  screens: "panels.next.fw.what.screens"
};

/** The keys that start a module (the article's "The firmware file"); key names are not translated */
const MODULE_KEYS: Partial<Record<FwModuleName, { keys: string[]; together?: boolean }>> = {
  updater: { keys: ["U"] },
  editor: { keys: ["Space"] },
  cores: { keys: ["C"] },
  testCard: { keys: ["A", "D", "V", "R"] },
  reset: { keys: ["N", "X"], together: true }
};

type T = ReturnType<typeof useT>;

/** A module's name, as the viewer shows it: the source's name, or its number */
function entryName(t: T, e: FwEntry, file: FwFile): string {
  if (!e.name) return t("panels.next.fw.module.numbered", { index: e.index });
  // --- In the old layout entries 1 and 3 are the editor and the cores module themselves
  if (file.layout === "old" && e.name === "editorOld") return t("panels.next.fw.module.editorOldReal");
  if (file.layout === "old" && e.name === "coresOld") return t("panels.next.fw.module.coresOldReal");
  return t(NAME_KEYS[e.name]);
}

function entryWhat(t: T, e: FwEntry, file: FwFile): string {
  if (e.aliasOf !== undefined) return t("panels.next.fw.what.alias", { index: e.aliasOf });
  if (!e.name) return t(e.kind === "data" ? "panels.next.fw.what.unnamedData" : "panels.next.fw.what.unnamedCode");
  if (file.layout === "old" && (e.name === "editorOld" || e.name === "coresOld")) {
    return t(e.name === "editorOld" ? "panels.next.fw.what.editor" : "panels.next.fw.what.cores");
  }
  return t(WHAT_KEYS[e.name]);
}

const num = (value: number) => value.toLocaleString("en-US");
const kb = (bytes: number) => (bytes >= 10240 ? `${num(Math.round(bytes / 1024))}K` : `${num(bytes)} B`);

/** Parses the file for the viewer. Only a file that is no firmware file at all is refused. */
export function loadFwFileContents(contents: Uint8Array): { fileInfo?: FwFileInfo; error?: string } {
  const file = parseFwFile(contents);
  if (file.format === "unknown") {
    return { error: translate(PROBLEM_KEYS[file.problems[0]?.code ?? "notFirmware"]) };
  }
  return { fileInfo: { file, data: contents } };
}

const FwFileViewerPanel = ({ document, contents, viewState }: DocumentProps<FwViewState>) => (
  <GenericFilePanel<FwFileInfo, FwViewState>
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
    fileLoader={loadFwFileContents}
    validRenderer={(ctx) => <FwView ctx={ctx} source={document.node?.projectPath ?? document.name ?? document.id} />}
  />
);

export const createFwFileViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <FwFileViewerPanel document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
);

type ViewProps = { ctx: ViewContext; source: string };

/** A module-level component, so it may hold state (see `GenericFilePanel`'s renderer note) */
const FwView = ({ ctx, source }: ViewProps) => {
  const info = ctx.fileInfo;
  if (!info) return null;
  const { file } = info;
  const selected = file.entries.find((e) => e.index === ctx.viewState?.selected) ?? file.entries[0];
  // --- An alias shows the module it repeats
  const target = selected?.aliasOf !== undefined ? file.entries[selected.aliasOf] : selected;
  return (
    <div className={styles.view} data-testid="fw-viewer">
      <FileSection ctx={ctx} info={info} source={source} />
      <ModulesSection ctx={ctx} file={file} selected={selected} target={target} />
      {selected && <DetailsSection ctx={ctx} info={info} entry={selected} target={target} source={source} />}
      {target?.kind === "code" && <ListingSection ctx={ctx} info={info} entry={target} />}
      {target?.name === "screens" && target.kind === "data" && <PictureSection ctx={ctx} info={info} entry={target} />}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// File
// ---------------------------------------------------------------------------------------------

const FileSection = ({ ctx, info, source }: { ctx: ViewContext; info: FwFileInfo; source: string }) => {
  const t = useT();
  const hub = useDocumentHubService();
  const { file, data } = info;
  const errors = file.problems.filter((p) => p.severity === "error").length;
  const warnings = file.problems.filter((p) => p.severity === "warning").length;
  const aliases = file.entries.filter((e) => e.aliasOf !== undefined).length;
  return (
    <ExpandableRow
      heading={t("panels.next.fw.heading.file")}
      headingAction={
        <SmallIconButton
          iconName="binary"
          title={t("panels.next.fw.mapDump")}
          clicked={() =>
            void openStaticMemoryDump(hub, `fwMap${source}`, t("panels.next.fw.mapDumpTitle", { source }), data.slice(0, FW_BLOCK))
          }
        />
      }
      meta={
        <span className={errors ? styles.error : warnings ? styles.warning : styles.ok}>
          {errors && warnings
            ? t("panels.next.fw.verdict.both", { errors, warnings })
            : errors
              ? t("panels.next.fw.verdict.errors", { errors })
              : warnings
                ? t("panels.next.fw.verdict.warnings", { warnings })
                : t("panels.next.fw.verdict.ok")}
        </span>
      }
      initialExpanded={ctx.viewState?.fileExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.fileExpanded = exp))}
    >
      <Row>
        <LabeledText
          label={t("panels.next.fw.label.firmware")}
          labelWidth={LABEL_WIDTH}
          value={file.version ?? t("panels.next.fw.versionUnknown")}
          valueTooltip={t("panels.next.fw.versionTooltip")}
        />
      </Row>
      <Row>
        <LabeledText
          label={t("panels.next.fw.label.fileSize")}
          labelWidth={LABEL_WIDTH}
          value={t("panels.next.fw.fileSize", { bytes: num(file.fileSize), blocks: num(Math.floor(file.fileSize / FW_BLOCK)) })}
        />
      </Row>
      <Row>
        <LabeledText
          label={t("panels.next.fw.label.map")}
          labelWidth={LABEL_WIDTH}
          value={t("panels.next.fw.mapUse", { count: file.entries.length, capacity: FW_MAP_CAPACITY, aliases })}
        />
      </Row>
      <Row>
        <LabeledText
          label={t("panels.next.fw.label.layout")}
          labelWidth={LABEL_WIDTH}
          value={t(file.layout === "old" ? "panels.next.fw.layout.old" : "panels.next.fw.layout.current")}
        />
      </Row>
      {file.problems.map((p, i) => (
        <Row key={i}>
          <Text
            text={t(PROBLEM_KEYS[p.code], { entry: p.entry ?? 0, other: p.otherEntry ?? 0 })}
            variant={p.severity === "error" ? "error" : p.severity === "warning" ? "warning" : undefined}
          />
        </Row>
      ))}
    </ExpandableRow>
  );
};

// ---------------------------------------------------------------------------------------------
// Modules: the map and the table
// ---------------------------------------------------------------------------------------------

/** One strip item per distinct module, in file order, with the map first */
type MapBlock = { index: number; entry?: FwEntry; size: number; tone: TapeSegmentTone };

function mapBlocks(file: FwFile): MapBlock[] {
  const broken = new Set(file.problems.filter((p) => p.severity === "error" && p.entry !== undefined).map((p) => p.entry));
  const modules = file.entries
    .filter((e) => e.aliasOf === undefined)
    .sort((a, b) => a.fileOffset - b.fileOffset)
    .map((entry, i): MapBlock => ({
      index: i + 1,
      entry,
      size: entry.byteLength,
      // --- The strip's two hues: error for a module with an error; code stands out of the track
      // --- more than data
      tone: broken.has(entry.index) ? "unplayable" : entry.kind === "code" ? "code" : "data"
    }));
  return [{ index: 0, size: FW_BLOCK, tone: "header" }, ...modules];
}

type ModulesProps = { ctx: ViewContext; file: FwFile; selected?: FwEntry; target?: FwEntry };

const ModulesSection = ({ ctx, file, selected, target }: ModulesProps) => {
  const t = useT();
  const blocks = useMemo(() => mapBlocks(file), [file]);
  const items = useMemo<TimelineItem[]>(() => blocks.map((b) => ({ index: b.index, ms: b.size, tone: b.tone })), [blocks]);
  const select = (index: number) => ctx.changeViewState((vs) => (vs.selected = index));
  const selectedBlock = target ? blocks.find((b) => b.entry === target)?.index : undefined;
  return (
    <ExpandableRow
      heading={t("panels.next.fw.heading.modules")}
      meta={t("panels.next.fw.entryCount", { count: file.entries.length })}
      initialExpanded={ctx.viewState?.modulesExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.modulesExpanded = exp))}
    >
      <div className={styles.map}>
        <TimelineStrip
          items={items}
          selectedIndex={selectedBlock}
          testId="fw-map"
          onSelect={(index) => {
            const entry = blocks[index]?.entry;
            if (entry) select(entry.index);
          }}
          tooltip={(segment) => {
            const block = blocks[segment.first];
            if (!block.entry) return t("panels.next.fw.map.header");
            return t("panels.next.fw.map.module", {
              index: block.entry.index,
              name: entryName(t, block.entry, file),
              size: kb(block.size)
            });
          }}
        />
      </div>
      <div className={styles.table} role="table">
        <DataRow xclass={styles.head}>
          <DataLabel text="#" xclass={styles.cNum} />
          <DataLabel text={t("panels.next.fw.col.module")} xclass={styles.cName} />
          <DataLabel text={t("panels.next.fw.col.keys")} xclass={styles.cKeys} />
          <DataLabel text={t("panels.next.fw.col.blocks")} xclass={styles.cBlocks} />
          <DataLabel text={t("panels.next.fw.col.offset")} xclass={styles.cOffset} />
          <DataLabel text={t("panels.next.fw.col.size")} xclass={styles.cSize} />
          <DataLabel text={t("panels.next.fw.col.note")} xclass={styles.cNote} />
        </DataRow>
        {file.entries.map((e, i) => (
          <DataRow
            key={e.index}
            index={i}
            clicked={() => select(e.index)}
            xclass={classnames(styles.row, { [styles.selected]: e === selected, [styles.alias]: e.aliasOf !== undefined })}
          >
            <DataValue text={String(e.index)} xclass={styles.cNum} />
            <DataValue text={entryName(t, e, file)} xclass={styles.cName} />
            <DataValue text={keysText(e, file)} xclass={styles.cKeys}>
              <Keys entry={e} file={file} />
            </DataValue>
            <DataValue text={`${e.start}+${e.length}`} xclass={styles.cBlocks} />
            <DataValue text={formatHex(e.fileOffset, 6)} xclass={styles.cOffset} />
            <DataValue text={kb(e.byteLength)} xclass={styles.cSize} />
            <DataSecondary text={entryWhat(t, e, file)} xclass={styles.cNote} />
          </DataRow>
        ))}
      </div>
    </ExpandableRow>
  );
};

function moduleKeys(e: FwEntry, file: FwFile) {
  if (e.aliasOf !== undefined || !e.name) return undefined;
  if (file.layout === "old" && (e.name === "editorOld" || e.name === "coresOld")) return undefined;
  return MODULE_KEYS[e.name];
}

function keysText(e: FwEntry, file: FwFile): string {
  const k = moduleKeys(e, file);
  return k ? k.keys.join(k.together ? " + " : " ") : "";
}

/** The key caps that start a module */
const Keys = ({ entry, file }: { entry: FwEntry; file: FwFile }) => {
  const k = moduleKeys(entry, file);
  if (!k) return null;
  return (
    <span className={styles.keys}>
      {k.keys.map((key, i) => (
        <span key={key} className={styles.keyGroup}>
          {i > 0 && k.together && <span className={styles.plus}>+</span>}
          <kbd className={styles.key}>{key}</kbd>
        </span>
      ))}
    </span>
  );
};

// ---------------------------------------------------------------------------------------------
// The selected module
// ---------------------------------------------------------------------------------------------

type DetailsProps = { ctx: ViewContext; info: FwFileInfo; entry: FwEntry; target?: FwEntry; source: string };

const DetailsSection = ({ ctx, info, entry, target, source }: DetailsProps) => {
  const t = useT();
  const hub = useDocumentHubService();
  const { file, data } = info;
  const m = target ?? entry;
  const inFile = m.kind !== undefined;
  const texts = useMemo(() => (inFile ? fwModuleTexts(data, m, TEXT_LIMIT + 1) : []), [data, m, inFile]);
  const openDump = (view: "memory" | "disassembly") =>
    void openStaticMemoryDump(
      hub,
      `fwModule${source}#${m.fileOffset}`,
      t("panels.next.fw.moduleDumpTitle", { source, name: entryName(t, m, file) }),
      data.slice(m.fileOffset, m.fileOffset + m.byteLength),
      m.kind === "code" ? { disassemblyEnabled: true, disassOffset: m.runsAt, viewMode: view } : undefined
    );
  const k = moduleKeys(entry, file);
  return (
    <ExpandableRow
      heading={t("panels.next.fw.heading.module", { index: entry.index, name: entryName(t, entry, file) })}
      headingAction={
        inFile ? (
          <>
            <SmallIconButton iconName="binary" title={t("panels.next.fw.moduleDump")} clicked={() => openDump("memory")} />
            {m.kind === "code" && (
              <SmallIconButton iconName="logs" title={t("panels.next.fw.moduleDisassembly")} clicked={() => openDump("disassembly")} />
            )}
          </>
        ) : undefined
      }
      initialExpanded={ctx.viewState?.detailsExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.detailsExpanded = exp))}
    >
      <Row>
        <LabeledText label={t("panels.next.fw.label.what")} labelWidth={LABEL_WIDTH} value={entryWhat(t, entry, file)} />
      </Row>
      {k && (
        <Row>
          <LabeledText
            label={t("panels.next.fw.label.startedBy")}
            labelWidth={LABEL_WIDTH}
            value={entry.name === "updater" ? t("panels.next.fw.updaterKeys") : keysText(entry, file)}
          />
        </Row>
      )}
      <Row>
        <LabeledText
          label={t("panels.next.fw.label.blocks")}
          labelWidth={LABEL_WIDTH}
          value={t("panels.next.fw.blockRange", { from: m.start, to: m.start + m.length - 1, count: num(m.length) })}
        />
      </Row>
      <Row>
        <LabeledText
          label={t("panels.next.fw.label.range")}
          labelWidth={LABEL_WIDTH}
          value={t("panels.next.fw.fileRange", {
            from: formatHex(m.fileOffset, 6),
            to: formatHex(m.fileOffset + m.byteLength - 1, 6),
            size: kb(m.byteLength)
          })}
          valueClassName={inFile ? undefined : styles.error}
        />
      </Row>
      {inFile && (
        <Row>
          <LabeledText
            label={t("panels.next.fw.label.kind")}
            labelWidth={LABEL_WIDTH}
            value={
              m.kind === "code"
                ? t("panels.next.fw.kind.code", { address: formatHex(m.runsAt ?? 0, 4) })
                : t("panels.next.fw.kind.data")
            }
          />
        </Row>
      )}
      {inFile && (
        <Row>
          <LabeledText
            label={t("panels.next.fw.label.tail")}
            labelWidth={LABEL_WIDTH}
            value={t("panels.next.fw.tail", { data: num(m.dataLength), padding: num(m.paddingLength) })}
          />
        </Row>
      )}
      {texts.slice(0, TEXT_LIMIT).map((text, i) => (
        <Row key={i}>
          <LabeledText label={i === 0 ? t("panels.next.fw.label.texts") : ""} labelWidth={LABEL_WIDTH} value={text} />
        </Row>
      ))}
      {texts.length > TEXT_LIMIT && (
        <Row>
          <LabeledText label="" labelWidth={LABEL_WIDTH} value={t("panels.next.fw.moreTexts")} valueClassName={styles.dim} />
        </Row>
      )}
    </ExpandableRow>
  );
};

// ---------------------------------------------------------------------------------------------
// The content: the listing of a code module, the picture of the screens block
// ---------------------------------------------------------------------------------------------

type ListingLine = { address: number; bytes: string; instruction: string };

type ContentProps = { ctx: ViewContext; info: FwFileInfo; entry: FwEntry };

const ListingSection = ({ ctx, info, entry }: ContentProps) => {
  const t = useT();
  const [lines, setLines] = useState<ListingLine[]>();
  useEffect(() => {
    let cancelled = false;
    setLines(undefined);
    const address = entry.runsAt ?? 0;
    const memory = new Uint8Array(0x10000);
    const length = Math.min(entry.byteLength, 0x10000 - address);
    memory.set(info.data.subarray(entry.fileOffset, entry.fileOffset + length), address);
    // --- Enough bytes for the listed instructions (four at most each), not the whole module
    const end = address + Math.min(length, LISTING_LIMIT * 4) - 1;
    const map = new MemoryMap();
    map.add(new MemorySection(address, end));
    void new Z80Disassembler(map.sections, memory, undefined, { allowExtendedSet: true })
      .disassemble(address, end)
      .then((output) => {
        if (cancelled) return;
        setLines(
          (output?.outputItems ?? []).slice(0, LISTING_LIMIT).map((item) => ({
            address: item.address,
            bytes: (item.opCodes ?? []).map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" "),
            instruction: item.instruction ?? ""
          }))
        );
      });
    return () => {
      cancelled = true;
    };
  }, [info.data, entry]);
  return (
    <ExpandableRow
      heading={t("panels.next.fw.heading.listing")}
      meta={t("panels.next.fw.listingMeta", { address: formatHex(entry.runsAt ?? 0, 4), count: LISTING_LIMIT })}
      initialExpanded={ctx.viewState?.contentExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.contentExpanded = exp))}
    >
      <div className={styles.listing} data-testid="fw-listing">
        {(lines ?? []).map((line) => (
          <DataRow key={line.address} dense xclass={styles.listingRow}>
            <DataValue text={formatHex(line.address, 4)} xclass={classnames(styles.lAddress, disassemblyText.address)} />
            <DataValue text={line.bytes} xclass={classnames(styles.lBytes, disassemblyText.opcodes)} />
            <DataValue text={line.instruction} xclass={classnames(styles.lInstruction, disassemblyText.instruction)} />
          </DataRow>
        ))}
        {lines && (
          <Row>
            <Text text={t("panels.next.fw.listingMore")} />
          </Row>
        )}
      </div>
    </ExpandableRow>
  );
};

const PictureSection = ({ ctx, info, entry }: ContentProps) => {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const card = useMemo(() => readFwTestCard(info.data, entry), [info.data, entry]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext?.("2d");
    if (!card || !context) return;
    const image = context.createImageData(FW_TEST_CARD_WIDTH, FW_TEST_CARD_HEIGHT);
    const colours = card.palette.map(rgb333Rgb);
    for (let i = 0; i < card.pixels.length; i++) {
      const [r, g, b] = colours[card.pixels[i]];
      image.data.set([r, g, b, 0xff], i * 4);
    }
    context.putImageData(image, 0, 0);
  }, [card]);
  return (
    <ExpandableRow
      heading={t("panels.next.fw.heading.picture")}
      meta={t("panels.next.fw.pictureMeta", { width: FW_TEST_CARD_WIDTH, height: FW_TEST_CARD_HEIGHT })}
      initialExpanded={ctx.viewState?.contentExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.contentExpanded = exp))}
    >
      {card ? (
        <div className={styles.picture}>
          <canvas
            ref={canvasRef}
            width={FW_TEST_CARD_WIDTH}
            height={FW_TEST_CARD_HEIGHT}
            aria-label={t("panels.next.fw.pictureAlt")}
            data-testid="fw-picture"
          />
        </div>
      ) : (
        <Row>
          <Text text={t("panels.next.fw.pictureMissing")} variant="warning" />
        </Row>
      )}
    </ExpandableRow>
  );
};
