import { useMemo } from "react";
import classnames from "classnames";
import { t as translate } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { Fact, FactNote, Facts, FactSection } from "@renderer/controls/data/FileFacts";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { DataLabel, DataRow, DataSecondary, DataValue, formatHex } from "@renderer/controls/data";
import { disassemblyText } from "@renderer/controls/data/DisassemblyText";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { TimelineStrip } from "../Tape/TimelineStrip";
import type { TapeSegmentTone, TimelineItem } from "../Tape/tapeView";
import {
  TBU_INDEX_CAPACITY,
  TBU_SECTOR,
  parseTbuFile,
  type TbuBitstreamInfo,
  type TbuFile,
  type TbuProblem,
  type TbuRecord
} from "@common/zxnext/tbuFile";
import { decodeBitstreamPackets, type BitstreamPacket, type BitstreamPackets } from "@common/zxnext/xilinxBitstream";
import styles from "./TbuFileViewerPanel.module.scss";

/*
 * The `TBBLUE.TBU` viewer (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md`, layout D7, bitstream D8): the file,
 * a to-scale map of its images, the cores table, the selected core's details and its bitstream's
 * configuration packets as a listing. Read-only; everything comes from `parseTbuFile` and
 * `decodeBitstreamPackets`.
 */

/* --- M2: `ch`, not px */
const LABEL_WIDTH = "14ch";

type TbuViewState = {
  scrollPosition?: number;
  fileExpanded?: boolean;
  coresExpanded?: boolean;
  detailsExpanded?: boolean;
  bitstreamExpanded?: boolean;
  /** The selected record's number */
  selected?: number;
};

type TbuFileInfo = { file: TbuFile; data: Uint8Array };

type ViewContext = GenericFileContext<TbuFileInfo, TbuViewState>;

/** Parses the file for the viewer. Only a file that is no TBU at all is refused; the rest is shown. */
export function loadTbuFileContents(contents: Uint8Array): { fileInfo?: TbuFileInfo; error?: string } {
  const file = parseTbuFile(contents);
  if (file.format === "unknown") {
    return { error: translate(PROBLEM_KEYS[file.problems[0]?.code === "tooShort" ? "tooShort" : "notTbu"]) };
  }
  return { fileInfo: { file, data: contents } };
}

const TbuFileViewerPanel = ({ document, contents, viewState }: DocumentProps<TbuViewState>) => (
  <GenericFilePanel<TbuFileInfo, TbuViewState>
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
    fileLoader={loadTbuFileContents}
    validRenderer={(ctx) => <TbuView ctx={ctx} source={document.node?.projectPath ?? document.name ?? document.id} />}
  />
);

export const createTbuFileViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <TbuFileViewerPanel document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
);

type ViewProps = { ctx: ViewContext; source: string };

/** A module-level component, so it may hold state (see `GenericFilePanel`'s renderer note) */
const TbuView = ({ ctx, source }: ViewProps) => {
  const info = ctx.fileInfo;
  if (!info) return null;
  const { file } = info;
  const selected = file.records.find((r) => r.number === ctx.viewState?.selected) ?? file.records[0];
  return (
    <div className={styles.view} data-testid="tbu-viewer">
      <FileSection ctx={ctx} info={info} source={source} />
      {file.format === "multi" && (
        <>
          <CoresSection ctx={ctx} file={file} selected={selected} />
          {selected && <DetailsSection ctx={ctx} info={info} record={selected} source={source} />}
          {selected?.bitstream?.family && (
            <BitstreamSection ctx={ctx} info={info} start={selected.fileOffset} end={imageDataEnd(selected)} bitstream={selected.bitstream} />
          )}
        </>
      )}
      {file.legacy?.bitstream.family && (
        <BitstreamSection ctx={ctx} info={info} start={TBU_SECTOR} end={file.imagesEnd} bitstream={file.legacy.bitstream} />
      )}
    </div>
  );
};

/** Where an image's bitstream ends: before its trailer sector, if it has one */
const imageDataEnd = (r: TbuRecord) => r.fileOffset + r.byteLength - (r.trailer ? TBU_SECTOR : 0);

const num = (value: number) => value.toLocaleString("en-US");
const kb = (bytes: number) => `${num(Math.round(bytes / 1024))}K`;

// ---------------------------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------------------------

type T = ReturnType<typeof useT>;

/* --- Keys at definition, text at display; whole keys, so the catalog check sees every one */
const PROBLEM_KEYS: Record<TbuProblem["code"], MessageKey> = {
  tooShort: "panels.next.tbu.problem.tooShort",
  notTbu: "panels.next.tbu.problem.notTbu",
  notSectorAligned: "panels.next.tbu.problem.notSectorAligned",
  trailingData: "panels.next.tbu.problem.trailingData",
  indexNotTerminated: "panels.next.tbu.problem.indexNotTerminated",
  recordLength: "panels.next.tbu.problem.recordLength",
  duplicateRecord: "panels.next.tbu.problem.duplicateRecord",
  imageOutOfRange: "panels.next.tbu.problem.imageOutOfRange",
  imageOverlap: "panels.next.tbu.problem.imageOverlap",
  checksumMismatch: "panels.next.tbu.problem.checksumMismatch",
  trailerMismatch: "panels.next.tbu.problem.trailerMismatch",
  partMismatch: "panels.next.tbu.problem.partMismatch",
  tooBigForSlot: "panels.next.tbu.problem.tooBigForSlot",
  legacySizeMismatch: "panels.next.tbu.problem.legacySizeMismatch",
  legacyChecksumMismatch: "panels.next.tbu.problem.legacyChecksumMismatch",
  legacyNotNext: "panels.next.tbu.problem.legacyNotNext"
};

const BOARD_KEYS: MessageKey[] = [
  "panels.next.tbu.boardName.0",
  "panels.next.tbu.boardName.1",
  "panels.next.tbu.boardName.2",
  "panels.next.tbu.boardName.3"
];

const STOP_KEYS: Partial<Record<BitstreamPackets["stop"], MessageKey>> = {
  unknownWord: "panels.next.tbu.packet.stop.unknownWord",
  truncated: "panels.next.tbu.packet.stop.truncated",
  limit: "panels.next.tbu.packet.stop.limit",
  noSync: "panels.next.tbu.packet.stop.noSync"
};

function boardText(t: T, r: TbuRecord): string {
  const board =
    r.boardId <= 3
      ? t(BOARD_KEYS[r.boardId])
      : t("panels.next.tbu.boardName.other", { issue: r.issue });
  return r.variant ? t("panels.next.tbu.boardVariant", { board, variant: r.variant }) : board;
}

function slotText(t: T, r: TbuRecord): string {
  if (r.slot === 1) return t("panels.next.tbu.slot.next");
  if (r.slot === 0) return t("panels.next.tbu.slot.antiBrick");
  return t("panels.next.tbu.slot.type", { type: r.type });
}

function problemText(t: T, p: TbuProblem): string {
  return t(PROBLEM_KEYS[p.code], { record: p.record ?? 0, other: p.otherRecord ?? 0 });
}

function fpgaText(t: T, b: TbuBitstreamInfo | undefined): string {
  if (!b?.family) return t("panels.next.tbu.fpga.unknown");
  const family = b.family === "spartan6" ? "Spartan-6" : "7-series";
  if (b.idcode === undefined) return family;
  return t("panels.next.tbu.fpga.part", {
    part: b.part ?? t("panels.next.tbu.fpga.unknownPart"),
    family,
    idcode: formatHex(b.idcode, 8),
    offset: b.idcodeOffset ?? 0
  });
}

// ---------------------------------------------------------------------------------------------
// File
// ---------------------------------------------------------------------------------------------

const FileSection = ({ ctx, info, source }: { ctx: ViewContext; info: TbuFileInfo; source: string }) => {
  const t = useT();
  const hub = useDocumentHubService();
  const { file, data } = info;
  const errors = file.problems.filter((p) => p.severity === "error").length;
  const warnings = file.problems.filter((p) => p.severity === "warning").length;
  const legacy = file.legacy;
  return (
    <FactSection
      title={t("panels.next.tbu.heading.file")}
      actions={
        <>
          <SmallIconButton
            iconName="binary"
            title={t("panels.next.tbu.headerDump")}
            clicked={() =>
              void openStaticMemoryDump(hub, `tbuHeader${source}`, t("panels.next.tbu.headerDumpTitle", { source }), data.slice(0, TBU_SECTOR))
            }
          />
          {/* --- The legacy file's one image: beside the header, as a core's dump is beside its heading */}
          {legacy && (
            <SmallIconButton
              iconName="binary"
              title={t("panels.next.tbu.imageDump")}
              clicked={() =>
                void openStaticMemoryDump(
                  hub,
                  `tbuImage${source}`,
                  t("panels.next.tbu.imageDumpTitle", { source, name: legacy.version }),
                  data.slice(TBU_SECTOR)
                )
              }
            />
          )}
        </>
      }
      meta={
        <span className={errors ? styles.error : warnings ? styles.warning : styles.ok}>
          {errors && warnings
            ? t("panels.next.tbu.verdict.both", { errors, warnings })
            : errors
              ? t("panels.next.tbu.verdict.errors", { errors })
              : warnings
                ? t("panels.next.tbu.verdict.warnings", { warnings })
                : t("panels.next.tbu.verdict.ok")}
        </span>
      }
      expanded={ctx.viewState?.fileExpanded ?? true}
      onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.fileExpanded = exp))}
    >
      <Facts labelWidth={LABEL_WIDTH}>
      <Fact label={t("panels.next.tbu.label.format")}>{t(legacy ? "panels.next.tbu.format.legacy" : "panels.next.tbu.format.multi")}</Fact>
      <Fact label={t("panels.next.tbu.label.fileSize")}>{t("panels.next.tbu.bytes", { count: file.fileSize })}</Fact>
      {!legacy && (
        <>
          <Fact label={t("panels.next.tbu.label.machine")}>{file.machine ?? ""}</Fact>
          <Fact label={t("panels.next.tbu.label.index")}>{t("panels.next.tbu.indexUse", { count: file.records.length, capacity: TBU_INDEX_CAPACITY })}</Fact>
        </>
      )}
      {legacy && (
        <>
          <Fact label={t("panels.next.tbu.label.hardware")}>{`${legacy.hardwareId} · ${legacy.hardwareName}`}</Fact>
          <Fact label={t("panels.next.tbu.label.core")}>{legacy.version}</Fact>
          <Fact label={t("panels.next.tbu.label.imageSize")}>{t("panels.next.tbu.legacySize", { stated: num(legacy.statedSize), actual: num(legacy.actualSize) })}</Fact>
          <Fact label={t("panels.next.tbu.label.checksum")} tone={legacy.storedXor === legacy.computedXor ? "ok" : "error"}>{t(legacy.storedXor === legacy.computedXor ? "panels.next.tbu.checksumOk" : "panels.next.tbu.checksumBad", {
                stored: formatHex(legacy.storedXor, 2),
                computed: formatHex(legacy.computedXor, 2)
              })}</Fact>
          <Fact label={t("panels.next.tbu.label.fpga")}>{fpgaText(t, legacy.bitstream)}</Fact>
        </>
      )}
      </Facts>
      {file.problems.map((p, i) => (
        <FactNote key={i} tone={p.severity === "error" ? "error" : p.severity === "warning" ? "warning" : "info"}>{problemText(t, p)}</FactNote>
      ))}
    </FactSection>
  );
};

// ---------------------------------------------------------------------------------------------
// Cores: the file map and the table
// ---------------------------------------------------------------------------------------------

/** One strip item per distinct image, in file order, with the header first (index -1) */
type MapBlock = { index: number; offset: number; size: number; records: TbuRecord[]; tone: TapeSegmentTone };

function mapBlocks(file: TbuFile): MapBlock[] {
  const byOffset = new Map<number, TbuRecord[]>();
  for (const r of file.records) {
    const group = byOffset.get(r.fileOffset);
    if (group) group.push(r);
    else byOffset.set(r.fileOffset, [r]);
  }
  const broken = new Set(file.problems.filter((p) => p.severity === "error" && p.record).map((p) => p.record));
  const blocks = [...byOffset.values()]
    .sort((a, b) => a[0].fileOffset - b[0].fileOffset)
    .map((records, i): MapBlock => ({
      index: i + 1,
      offset: records[0].fileOffset,
      size: records[0].byteLength,
      records,
      // --- The strip's two hues (`ui-theming-intent-and-lessons.md`, "A Proportional Strip"):
      // --- the error for an image with an error, else neutral, Next cores standing out most
      tone: records.some((r) => broken.has(r.number)) ? "unplayable" : records[0].slot === 1 ? "code" : "data"
    }));
  return [{ index: 0, offset: 0, size: TBU_SECTOR, records: [], tone: "header" }, ...blocks];
}

const CoresSection = ({ ctx, file, selected }: { ctx: ViewContext; file: TbuFile; selected?: TbuRecord }) => {
  const t = useT();
  const blocks = useMemo(() => mapBlocks(file), [file]);
  const items = useMemo<TimelineItem[]>(() => blocks.map((b) => ({ index: b.index, ms: b.size, tone: b.tone })), [blocks]);
  const select = (n: number) => ctx.changeViewState((vs) => (vs.selected = n));
  const selectedBlock = selected ? blocks.find((b) => b.records.includes(selected))?.index : undefined;
  return (
    <FactSection
      title={t("panels.next.tbu.heading.cores")}
      meta={t("panels.next.tbu.coreCount", { count: file.records.length })}
      expanded={ctx.viewState?.coresExpanded ?? true}
      onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.coresExpanded = exp))}
    >
      {file.records.length > 0 && (
        <div className={styles.map}>
          <TimelineStrip
            items={items}
            selectedIndex={selectedBlock}
            testId="tbu-map"
            onSelect={(index) => {
              const block = blocks[index];
              if (block?.records.length) select(block.records[0].number);
            }}
            tooltip={(segment) => {
              const block = blocks[segment.first];
              if (!block.records.length) return t("panels.next.tbu.map.header");
              return t("panels.next.tbu.map.image", {
                records: block.records.map((r) => `#${r.number}`).join(", "),
                offset: formatHex(block.offset, 6),
                size: kb(block.size)
              });
            }}
          />
        </div>
      )}
      <div className={styles.table} role="table">
        <DataRow xclass={styles.head}>
          <DataLabel text="#" xclass={styles.cNum} />
          <DataLabel text={t("panels.next.tbu.col.slot")} xclass={styles.cSlot} />
          <DataLabel text={t("panels.next.tbu.col.board")} xclass={styles.cBoard} />
          <DataLabel text={t("panels.next.tbu.col.core")} xclass={styles.cCore} />
          <DataLabel text={t("panels.next.tbu.col.offset")} xclass={styles.cOffset} />
          <DataLabel text={t("panels.next.tbu.col.size")} xclass={styles.cSize} />
          <DataLabel text={t("panels.next.tbu.col.checksum")} xclass={styles.cCheck} />
          <DataLabel text={t("panels.next.tbu.col.fpga")} xclass={styles.cFpga} />
          <DataLabel text={t("panels.next.tbu.col.note")} xclass={styles.cNote} />
        </DataRow>
        {file.records.map((r, i) => {
          const ok = r.computedChecksum === r.storedChecksum;
          return (
            <DataRow
              key={r.number}
              index={i}
              clicked={() => select(r.number)}
              xclass={classnames(styles.row, { [styles.selected]: r === selected })}
            >
              <DataValue text={String(r.number)} xclass={styles.cNum} />
              <DataValue text={slotText(t, r)} xclass={classnames(styles.cSlot, { [styles.warning]: r.slot !== 1 })} />
              <DataValue text={boardText(t, r)} xclass={styles.cBoard} />
              <DataValue text={r.version} xclass={styles.cCore} />
              <DataValue text={formatHex(r.fileOffset, 6)} xclass={styles.cOffset} />
              <DataValue text={kb(r.byteLength)} xclass={styles.cSize} />
              <DataValue
                text={`${formatHex(r.storedChecksum, 4)} ${r.computedChecksum === undefined ? "?" : ok ? "✓" : "✗"}`}
                xclass={classnames(styles.cCheck, r.computedChecksum === undefined ? undefined : ok ? styles.ok : styles.error)}
              />
              <DataValue text={r.bitstream?.part ?? ""} xclass={styles.cFpga} />
              <DataSecondary
                text={r.sharedWith.length ? t("panels.next.tbu.sharedWith", { records: r.sharedWith.join(", ") }) : ""}
                xclass={styles.cNote}
              />
            </DataRow>
          );
        })}
      </div>
    </FactSection>
  );
};

// ---------------------------------------------------------------------------------------------
// The selected core
// ---------------------------------------------------------------------------------------------

const DetailsSection = ({ ctx, info, record: r, source }: { ctx: ViewContext; info: TbuFileInfo; record: TbuRecord; source: string }) => {
  const t = useT();
  const hub = useDocumentHubService();
  const { data } = info;
  const b = r.bitstream;
  const inFile = r.computedChecksum !== undefined;
  const trailer = r.trailer;
  const trailerPeer = trailer && !trailer.matchesRecord
    ? r.sharedWith.find((n) => info.file.records[n - 1]?.trailer?.matchesRecord)
    : undefined;
  return (
    <FactSection
      title={t("panels.next.tbu.heading.core", { number: r.number, name: r.pullName })}
      actions={
        inFile ? (
          <>
            <SmallIconButton
              iconName="binary"
              title={t("panels.next.tbu.imageDump")}
              clicked={() =>
                void openStaticMemoryDump(
                  hub,
                  `tbuImage${source}#${r.fileOffset}`,
                  t("panels.next.tbu.imageDumpTitle", { source, name: r.pullName }),
                  data.slice(r.fileOffset, r.fileOffset + r.byteLength)
                )
              }
            />
          </>
        ) : undefined
      }
      expanded={ctx.viewState?.detailsExpanded ?? true}
      onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.detailsExpanded = exp))}
    >
      <Facts labelWidth={LABEL_WIDTH}>
      <Fact label={t("panels.next.tbu.label.slot")}>{slotText(t, r)}</Fact>
      <Fact label={t("panels.next.tbu.label.board")} title={t("panels.next.tbu.boardByteTooltip")}>{t("panels.next.tbu.boardByte", { byte: formatHex(r.boardByte, 2), board: boardText(t, r) })}</Fact>
      <Fact label={t("panels.next.tbu.label.core")}>{r.version}</Fact>
      <Fact label={t("panels.next.tbu.label.image")}>{t("panels.next.tbu.imageRange", {
            from: formatHex(r.fileOffset, 6),
            to: formatHex(r.fileOffset + r.byteLength - 1, 6),
            sectors: num(r.sectorLength)
          })}</Fact>
      <Fact label={t("panels.next.tbu.label.checksum")} tone={!inFile || r.computedChecksum !== r.storedChecksum ? "error" : "ok"}>{
            !inFile
              ? t("panels.next.tbu.checksumMissing", { stored: formatHex(r.storedChecksum, 4) })
              : t(r.computedChecksum === r.storedChecksum ? "panels.next.tbu.checksumOk" : "panels.next.tbu.checksumBad", {
                  stored: formatHex(r.storedChecksum, 4),
                  computed: formatHex(r.computedChecksum!, 4)
                })
          }</Fact>
      {r.sharedWith.length > 0 && (
        <Fact label={t("panels.next.tbu.label.shared")}>{t("panels.next.tbu.sharedWith", { records: r.sharedWith.join(", ") })}</Fact>
      )}
      <Fact label={t("panels.next.tbu.label.fpga")}>{fpgaText(t, b)}</Fact>
      {b && (
        <Fact label={t("panels.next.tbu.label.bitstream")}>{t("panels.next.tbu.bitstreamSize", { data: num(b.dataLength), padding: num(b.paddingLength) })}</Fact>
      )}
      {r.slotSize !== undefined && (
        <Fact label={t("panels.next.tbu.label.slotFit")} tone={r.byteLength > r.slotSize ? "error" : "ok"}>{t("panels.next.tbu.slotFit", { size: kb(r.byteLength), slot: kb(r.slotSize) })}</Fact>
      )}
      <Fact label={t("panels.next.tbu.label.trailer")} tone={trailer && !trailer.matchesRecord && !trailerPeer ? "warning" : "neutral"}>{
            !trailer
              ? t("panels.next.tbu.trailer.none")
              : trailer.matchesRecord
                ? t("panels.next.tbu.trailer.matches", { text: trailer.description })
                : trailerPeer
                  ? t("panels.next.tbu.trailer.peer", { text: trailer.description, record: trailerPeer })
                  : t("panels.next.tbu.trailer.differs", { text: trailer.description })
          }</Fact>
      </Facts>
    </FactSection>
  );
};

// ---------------------------------------------------------------------------------------------
// The bitstream's packets, as a listing (D8, style 3)
// ---------------------------------------------------------------------------------------------

type BitstreamProps = { ctx: ViewContext; info: TbuFileInfo; start: number; end: number; bitstream: TbuBitstreamInfo };

const BitstreamSection = ({ ctx, info, start, end, bitstream }: BitstreamProps) => {
  const t = useT();
  const expanded = ctx.viewState?.bitstreamExpanded ?? true;
  const family = bitstream.family!;
  const decoded = useMemo(
    () => decodeBitstreamPackets(info.data, start, end, family),
    [info.data, start, end, family]
  );
  return (
    <FactSection
      title={t("panels.next.tbu.heading.bitstream")}
      meta={t("panels.next.tbu.bitstreamMeta", {
        family: family === "spartan6" ? "Spartan-6" : "7-series",
        count: decoded.packets.length,
        frame: num(decoded.frameDataBytes)
      })}
      expanded={expanded}
      onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.bitstreamExpanded = exp))}
    >
      <div className={styles.listing} data-testid="tbu-bitstream">
        {decoded.syncOffset !== undefined && (
          <ListingRow offset={decoded.syncOffset} op="SYNC" value="AA995566" comment={t("panels.next.tbu.packet.sync")} />
        )}
        {decoded.packets.map((p, i) => (
          <PacketRow key={i} p={p} decoded={decoded} t={t} />
        ))}
        {STOP_KEYS[decoded.stop] && (
          <FactNote tone="warning">{t(STOP_KEYS[decoded.stop]!, { offset: formatHex(decoded.end, 6) })}</FactNote>
        )}
      </div>
    </FactSection>
  );
};

const PacketRow = ({ p, decoded, t }: { p: BitstreamPacket; decoded: BitstreamPackets; t: T }) => {
  const wordDigits = decoded.family === "spartan6" ? 4 : 8;
  if (p.op === "nop") {
    return <ListingRow offset={p.offset} op="NOP" comment={p.repeat ? t("panels.next.tbu.packet.repeat", { count: p.repeat }) : undefined} dim />;
  }
  const register = p.registerName ?? formatHex(p.register, 2);
  const op = p.op === "write" ? "WRITE" : p.op === "read" ? "READ" : "RSVD";
  if (p.type === 2) {
    const comment = p.autoCrc !== undefined
      ? t("panels.next.tbu.packet.frameDataCrc", { bytes: num(p.bytes - 4), crc: formatHex(p.autoCrc, 8) })
      : t("panels.next.tbu.packet.block", { bytes: num(p.bytes) });
    return <ListingRow offset={p.offset} op={op} register={register} comment={comment} block />;
  }
  const value =
    p.value === undefined
      ? p.words > 0
        ? t("panels.next.tbu.packet.words", { count: p.words })
        : ""
      : formatHex(p.value, p.words === 2 && decoded.family === "spartan6" ? 8 : (wordDigits as 4 | 8), "");
  return <ListingRow offset={p.offset} op={op} register={register} value={value} comment={p.command ?? p.part} />;
};

type ListingRowProps = {
  offset: number;
  op: string;
  register?: string;
  value?: string;
  comment?: string;
  dim?: boolean;
  block?: boolean;
};

const ListingRow = ({ offset, op, register, value, comment, dim, block }: ListingRowProps) => (
  <DataRow dense xclass={styles.listingRow}>
    <DataValue text={`+${formatHex(offset, 6, "")}`} xclass={classnames(styles.lOffset, disassemblyText.address)} />
    <DataValue text={op} xclass={classnames(styles.lOp, dim ? disassemblyText.comment : disassemblyText.instruction)} />
    <DataValue text={register ?? ""} xclass={classnames(styles.lReg, disassemblyText.operand)} />
    <DataValue text={value ?? ""} xclass={classnames(styles.lValue, disassemblyText.operand)} />
    <DataValue
      text={comment ? `; ${comment}` : ""}
      xclass={classnames(styles.lComment, block ? styles.block : disassemblyText.comment)}
    />
  </DataRow>
);
