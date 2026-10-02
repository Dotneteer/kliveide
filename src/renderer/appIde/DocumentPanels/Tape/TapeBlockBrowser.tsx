import { useMemo } from "react";
import {
  BankBrowser,
  BankChip,
  BankDetailsSection,
  BankFacts,
  BankGroupLabel,
  BankRowText,
  type BankBrowserItem
} from "@renderer/controls/bankBrowser/BankBrowser";
import { ContextMenuItem } from "@renderer/controls/ContextMenu";
import { AddressInput } from "@renderer/controls/AddressInput";
import { MiniMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { SPECTRUM_48_COLORS } from "@emu/machines/spectrum-colors";
import { ZxSpectrumChars } from "@common/machines/char-codes";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { BasicLineDisplay } from "../BasicPanel";
import { decodeBasicProgram } from "../basicListing";
import { createScrPixelData } from "../Next/ScrFileViewerPanel";
import { TapeTimeline } from "./TapeTimeline";
import {
  TAPE_BLOCK_FILTERS,
  TAPE_ROLE_NAMES,
  TAPE_VIEW_NAMES,
  blockLoadAddress,
  blockPayload,
  blockStartTimes,
  defaultTapeBlockView,
  filterTapeBlocks,
  formatPlayTime,
  tapeBlockViews,
  type TapeAnalysis,
  type TapeBlockInfo,
  type TapeBlockView
} from "./tapeView";
import styles from "./TapeViewerPanel.module.scss";

/*
 * The tape viewer's blocks (`.plans/TAPE_VIEWER_PLAN.md` §4.4): every block in one list, grouped by
 * file, with the selected block's details beside it and the timeline strip above. The list, keyboard
 * and pop-out are the shared `BankBrowser` shell, numbered `#n` rather than `$NN`.
 *
 * Like the NEX and Z88 browsers, it decides nothing about documents: the viewer hands it callbacks.
 */

/** How many BASIC lines the details list before pointing at the pop-out */
export const INLINE_BASIC_LINES = 40;

/** How many bytes of a block the details preview */
const PREVIEW_BYTES = 64;

export type TapeBlockItem = BankBrowserItem<TapeBlockView> & { block: TapeBlockInfo };

/** A block read as BASIC: the program's bytes and where its variables start */
export type TapeBasicSource = { bytes: Uint8Array; end: number; autostart?: number };

/**
 * The BASIC program a block holds: a block after a Program header, or any data block the user asked
 * to read as BASIC (whose length is then the whole payload, as no header says where VARS starts).
 */
export function basicSourceOf(
  analysis: TapeAnalysis,
  block: TapeBlockInfo,
  interpretAsBasic = false
): TapeBasicSource | undefined {
  const bytes = blockPayload(block);
  if (!bytes) return undefined;
  if (block.role === "basic") {
    const header =
      block.headerIndex !== undefined ? analysis.blocks[block.headerIndex].header : undefined;
    const end = Math.min(header?.variablesOffset ?? bytes.length, bytes.length);
    return { bytes, end, autostart: header?.autostart };
  }
  return interpretAsBasic && block.kind === "data" ? { bytes, end: bytes.length } : undefined;
}

type Props = {
  analysis: TapeAnalysis;
  selectedIndex?: number;
  filter: string;
  /** The view each block last popped out in */
  blockView?: Record<number, TapeBlockView>;
  /** Blocks without a header the user asked to read as BASIC */
  basicOverride?: Record<number, boolean>;
  /** The address the user chose to list a block at, for blocks no header places */
  listAt?: Record<number, number>;
  onSelect: (index: number) => void;
  onFilterChange: (filter: string) => void;
  onPopOut: (index: number, view: TapeBlockView) => void;
  onInterpretAsBasic: (index: number, on: boolean) => void;
  onListAt: (index: number, address: number) => void;
};

export const TapeBlockBrowser = ({
  analysis,
  selectedIndex,
  filter,
  blockView,
  basicOverride,
  listAt,
  onSelect,
  onFilterChange,
  onPopOut,
  onInterpretAsBasic,
  onListAt
}: Props) => {
  const starts = useMemo(() => blockStartTimes(analysis.blocks), [analysis]);
  const items = useMemo<TapeBlockItem[]>(
    () =>
      analysis.blocks.map((block) => {
        const views = viewsOf(block, !!basicOverride?.[block.index]);
        const remembered = blockView?.[block.index];
        const fallback = basicOverride?.[block.index] ? "basic" : defaultTapeBlockView(block);
        return {
          key: `${block.index}`,
          bank: block.index,
          lastView: remembered && views.includes(remembered) ? remembered : fallback,
          block
        };
      }),
    [analysis, blockView, basicOverride]
  );
  const { summary } = analysis;

  return (
    <BankBrowser<TapeBlockItem, TapeBlockView>
      visibleItems={filterTapeBlocks(items, filter)}
      selectedKey={selectedIndex === undefined ? undefined : `${selectedIndex}`}
      heading="Blocks"
      summary={`${summary.blockCount} block${summary.blockCount === 1 ? "" : "s"} · ${
        summary.fileCount
      } file${summary.fileCount === 1 ? "" : "s"}`}
      filters={TAPE_BLOCK_FILTERS}
      filter={filter}
      views={["memory", "disassembly", "basic", "screen"]}
      viewNames={TAPE_VIEW_NAMES}
      itemNoun="Block"
      formatNumber={(item) => `#${item.bank}`}
      viewsFor={(item) => viewsOf(item.block, !!basicOverride?.[item.block.index])}
      onSelect={(item) => onSelect(item.block.index)}
      onFilterChange={onFilterChange}
      onPopOut={(item, view) => onPopOut(item.block.index, view)}
      beforeBody={
        <TapeTimeline
          blocks={analysis.blocks}
          selectedIndex={selectedIndex ?? items[0]?.block.index}
          onSelect={onSelect}
        />
      }
      groupOf={(item) => ({
        key: item.block.groupKey,
        label: <BankGroupLabel title={item.block.groupLabel} />
      })}
      renderRow={(item) => <Row block={item.block} analysis={analysis} />}
      renderDetailsMarks={(item) => <Marks block={item.block} />}
      renderDetails={(item) => (
        <Details
          analysis={analysis}
          block={item.block}
          startMs={starts[item.block.index]}
          interpretAsBasic={!!basicOverride?.[item.block.index]}
          listAt={listAt?.[item.block.index]}
          onListAt={(address) => onListAt(item.block.index, address)}
          onShowAll={() => onPopOut(item.block.index, "basic")}
        />
      )}
      renderRowMenuItems={(item, close) =>
        item.block.kind === "data" && item.block.bytes && item.block.role !== "basic" ? (
          <ContextMenuItem
            text={basicOverride?.[item.block.index] ? "Stop Reading as BASIC" : "Read as BASIC"}
            clicked={() => {
              close();
              onInterpretAsBasic(item.block.index, !basicOverride?.[item.block.index]);
            }}
          />
        ) : null
      }
      hint="Pop out a block from its row's icon, by double-clicking the row, or with Enter."
    />
  );
};

function viewsOf(block: TapeBlockInfo, interpretAsBasic: boolean): TapeBlockView[] {
  const views = tapeBlockViews(block);
  if (interpretAsBasic && views.length > 0 && !views.includes("basic")) views.push("basic");
  return views;
}

const fmt = (value: number) => value.toLocaleString("en-US");

/** The row: chip, a short text, and the length (or duration) on the right */
const Row = ({ block, analysis }: { block: TapeBlockInfo; analysis: TapeAnalysis }) => {
  const header =
    block.headerIndex !== undefined ? analysis.blocks[block.headerIndex].header : undefined;
  let text = block.summary;
  if (block.role === "basic" && header) {
    text = header.autostart !== undefined ? `LINE ${header.autostart}` : "Program";
  } else if (
    (block.role === "code" || block.role === "screen") &&
    header?.startAddress !== undefined
  ) {
    text = `$${toHexa4(header.startAddress)}`;
  } else if (block.header?.arrayName) {
    text = `${block.header.typeName} header`;
  }
  const right = block.bytes
    ? fmt(block.bytes.length)
    : block.durationMs > 0
      ? `${fmt(Math.round(block.durationMs))} ms`
      : "";
  return (
    <>
      <BankChip
        tone={block.carriesSignal && !block.playable ? "error" : undefined}
        alt={block.kind === "header"}
      >
        {block.chip}
      </BankChip>
      <Problems block={block} />
      <BankRowText title={text}>{text}</BankRowText>
      <span className={styles.rowLength}>{right}</span>
    </>
  );
};

/** The status chips a row and the details share */
const Problems = ({ block }: { block: TapeBlockInfo }) => (
  <>
    {block.checksumOk === false && (
      <BankChip tone="warning" title="The block's checksum does not match its bytes">
        checksum
      </BankChip>
    )}
    {block.lengthMismatch && (
      <BankChip tone="warning" title="The block's length differs from what its header says">
        length
      </BankChip>
    )}
    {block.carriesSignal && !block.playable && (
      <BankChip tone="error" title="Klive's tape player skips this block, so a load may fail">
        not played
      </BankChip>
    )}
  </>
);

/** The chips beside the details title */
const Marks = ({ block }: { block: TapeBlockInfo }) => (
  <>
    <BankChip alt={block.kind === "header"}>{block.chip}</BankChip>
    {block.flag !== undefined && <BankChip alt>{`flag $${toHexa2(block.flag)}`}</BankChip>}
    {block.blockId === 0x11 && <BankChip>turbo</BankChip>}
    <Problems block={block} />
  </>
);

type DetailsProps = {
  analysis: TapeAnalysis;
  block: TapeBlockInfo;
  startMs: number;
  interpretAsBasic: boolean;
  listAt?: number;
  onListAt: (address: number) => void;
  onShowAll: () => void;
};

const Details = ({
  analysis,
  block,
  startMs,
  interpretAsBasic,
  listAt,
  onListAt,
  onShowAll
}: DetailsProps) => {
  const fileHeader =
    block.headerIndex !== undefined ? analysis.blocks[block.headerIndex].header : undefined;
  const payload = blockPayload(block);
  const basic = basicSourceOf(analysis, block, interpretAsBasic);
  const placedByHeader = block.role === "code" || block.role === "screen" || block.role === "basic";
  const loadAt = blockLoadAddress(block, fileHeader, listAt ?? 0);
  const end = startMs + block.durationMs;
  return (
    <>
      <BankFacts>
        <dt>Kind</dt>
        <dd>
          {block.kindName}
          {block.blockId !== undefined ? ` ($${toHexa2(block.blockId)})` : ""}
        </dd>
        {block.role && block.kind === "data" && (
          <>
            <dt>Holds</dt>
            <dd>{TAPE_ROLE_NAMES[block.role]}</dd>
          </>
        )}
        {block.bytes && (
          <>
            <dt>Length</dt>
            <dd>
              {`${fmt(block.bytes.length)} bytes`}
              {payload && payload !== block.bytes ? ` (${fmt(payload.length)} of data)` : ""}
            </dd>
          </>
        )}
        {block.checksumOk !== undefined && (
          <>
            <dt>Checksum</dt>
            <dd>{block.checksumOk ? "OK" : "Does not match"}</dd>
          </>
        )}
        {block.carriesSignal && (
          <>
            <dt>Plays</dt>
            <dd>
              {`${formatPlayTime(startMs)}–${formatPlayTime(end)}`}
              {block.durationApprox ? " (approx.)" : ""}
            </dd>
          </>
        )}
        {block.pauseMs > 0 && block.kind !== "pause" && (
          <>
            <dt>Pause after</dt>
            <dd>{`${fmt(block.pauseMs)} ms`}</dd>
          </>
        )}
        {block.kind === "pause" && (
          <>
            <dt>Duration</dt>
            <dd>{`${fmt(block.pauseMs)} ms`}</dd>
          </>
        )}
        {block.carriesSignal && !block.playable && (
          <>
            <dt>Klive</dt>
            <dd>Skipped when the tape plays</dd>
          </>
        )}
        {block.text && block.kind !== "pause" && (
          <>
            <dt>Text</dt>
            <dd className={styles.wrap}>{block.text}</dd>
          </>
        )}
      </BankFacts>

      {block.header && <HeaderFacts header={block.header} />}

      {fileHeader && (
        <BankDetailsSection
          title={`File ${fileHeader.typeName.toLowerCase()} "${fileHeader.name}"`}
        >
          <BankFacts>
            <dt>Header</dt>
            <dd>{`#${block.headerIndex}`}</dd>
            <dt>Expected</dt>
            <dd>{`${fmt(fileHeader.dataLength)} bytes`}</dd>
            {fileHeader.startAddress !== undefined && (
              <>
                <dt>Loads at</dt>
                <dd>{`$${toHexa4(fileHeader.startAddress)} (${fileHeader.startAddress})`}</dd>
              </>
            )}
          </BankFacts>
        </BankDetailsSection>
      )}

      {block.timing && block.blockId !== undefined && block.blockId !== 0x10 && (
        <BankDetailsSection title="Timing (T-states)">
          <BankFacts>
            <dt>Pilot</dt>
            <dd>{`${fmt(block.timing.pilotPulse)} × ${fmt(block.timing.pilotCount)}`}</dd>
            <dt>Sync</dt>
            <dd>{`${fmt(block.timing.sync1)} / ${fmt(block.timing.sync2)}`}</dd>
            <dt>Bits</dt>
            <dd>{`${fmt(block.timing.bit0)} / ${fmt(block.timing.bit1)}`}</dd>
          </BankFacts>
        </BankDetailsSection>
      )}

      {block.archive && block.archive.length > 0 && (
        <BankDetailsSection title="Archive info">
          <BankFacts>
            {block.archive.map((field, i) => (
              <ArchiveField key={i} label={field.label} value={field.value} />
            ))}
          </BankFacts>
        </BankDetailsSection>
      )}

      {basic && <BasicPreview source={basic} onShowAll={onShowAll} />}

      {block.role === "screen" && payload && payload.length >= 6912 && (
        <BankDetailsSection title="Screen">
          <div className={styles.screen}>
            <ScreenCanvas
              data={payload}
              palette={SPECTRUM_48_COLORS}
              zoomFactor={1}
              screenWidth={256}
              screenHeight={192}
              createPixelData={createScrPixelData}
            />
          </div>
        </BankDetailsSection>
      )}

      {payload && !basic && block.role !== "screen" && (
        <BankDetailsSection title={`First ${Math.min(PREVIEW_BYTES, payload.length)} bytes`}>
          {!placedByHeader && (
            <div className={styles.listAt}>
              <AddressInput
                label="List at:"
                tooltip="The address to list this block at in Disassembly (hex). Enter to apply."
                decimalView={false}
                clearOnEnter={false}
                onAddressSent={async (address) => onListAt(address & 0xffff)}
              />
              <span className={styles.listAtValue}>{`$${toHexa4(loadAt)}`}</span>
            </div>
          )}
          <MiniMemoryDump contents={payload} length={PREVIEW_BYTES} />
        </BankDetailsSection>
      )}
    </>
  );
};

const ArchiveField = ({ label, value }: { label: string; value: string }) => (
  <>
    <dt>{label}</dt>
    <dd className={styles.wrap}>{value}</dd>
  </>
);

const HeaderFacts = ({ header }: { header: NonNullable<TapeBlockInfo["header"]> }) => (
  <BankDetailsSection title="Header">
    <BankFacts>
      <dt>Name</dt>
      <dd className={styles.wrap}>{`"${header.name}"`}</dd>
      <dt>Type</dt>
      <dd>{`${header.typeName} (${header.type})`}</dd>
      <dt>Data length</dt>
      <dd>{`${fmt(header.dataLength)} bytes`}</dd>
      {header.type === 0 && (
        <>
          <dt>Autostart</dt>
          <dd>{header.autostart !== undefined ? `LINE ${header.autostart}` : "None"}</dd>
          <dt>Program</dt>
          <dd>{`${fmt(header.variablesOffset ?? 0)} bytes`}</dd>
          <dt>Variables</dt>
          <dd>{`${fmt(Math.max(0, header.dataLength - (header.variablesOffset ?? 0)))} bytes`}</dd>
        </>
      )}
      {header.startAddress !== undefined && (
        <>
          <dt>Start</dt>
          <dd>{`$${toHexa4(header.startAddress)} (${header.startAddress})`}</dd>
        </>
      )}
      {header.arrayName && (
        <>
          <dt>Array</dt>
          <dd>{header.arrayName}</dd>
        </>
      )}
    </BankFacts>
  </BankDetailsSection>
);

const BasicPreview = ({
  source,
  onShowAll
}: {
  source: TapeBasicSource;
  onShowAll: () => void;
}) => {
  const listing = useMemo(
    () => decodeBasicProgram(source.bytes, 0, source.end, { charSet: ZxSpectrumChars }),
    // --- `source` is rebuilt on every render; what it holds is what matters
    [source.bytes, source.end]
  );
  const lines = listing.lines.filter((line) => line.spans.length > 0);
  const shown = lines.slice(0, INLINE_BASIC_LINES);
  const more = lines.length - shown.length;
  return (
    <BankDetailsSection
      title={`BASIC (${listing.lineCount} line${listing.lineCount === 1 ? "" : "s"})`}
    >
      <div className={styles.basic} data-testid="tape-basic-preview">
        {shown.map((line, i) => (
          <BasicLineDisplay key={i} spans={line.spans} />
        ))}
      </div>
      {more > 0 && (
        <button type="button" className={styles.more} onClick={onShowAll}>
          {`… ${more} more line${more === 1 ? "" : "s"} · pop out the listing`}
        </button>
      )}
    </BankDetailsSection>
  );
};
