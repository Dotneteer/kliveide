import { useCallback, useMemo, useRef, useState } from "react";
import classnames from "classnames";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { MemoryDumpSection } from "@renderer/features/memory/MemoryDumpSection";
import { VirtualizedList, type VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import { DataRow, EmptyState } from "@renderer/controls/data";
import { useT } from "@common/i18n/useT";
import { uiLocale } from "@common/i18n/i18n";
import { useRowSizes } from "@renderer/theming/useRowSizes";
import frame from "@renderer/features/memoryMap/MemoryMap.module.scss";
import { Check, FindBox, GoToBox, Segmented, ToolGroup } from "@renderer/features/memoryMap/FrameControls";
import { ByteInspector } from "@renderer/features/memoryMap/ByteSections";
import { useByteView } from "@renderer/features/memoryMap/useByteView";
import { parseGoToNumber } from "@renderer/features/memoryMap/goToTarget";

/*
 * The binary file viewer: any file Klive has no better viewer for, as a hex dump. It shares the
 * Memory view's frame (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md`): the Go to and Find boxes,
 * 8/16/32 bytes a row, Hex/Dec, a cursor and selection, and a read-only inspector of the byte under
 * the cursor. The bytes are the file's, so nothing here writes.
 */

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

type BytesPerRow = 8 | 16 | 32;

const BinFileViewerPanelComponent = ({ contents }: DocumentProps) => {
  const t = useT();
  const data = useMemo(() => (contents as Uint8Array) ?? new Uint8Array(0), [contents]);
  const { memory: rowHeight } = useRowSizes();

  const [decimalView, setDecimalView] = useState(false);
  const [charDump, setCharDump] = useState(true);
  const [bytesPerRow, setBytesPerRow] = useState<BytesPerRow>(16);
  const [inspectorShown, setInspectorShown] = useState(true);
  const vlApi = useRef<VirtualizedListApi | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // --- 4 hex digits for files up to 64 KB, 6 beyond (up to 4 MB)
  const addressDigits: 4 | 6 = data.length <= 0x1_0000 ? 4 : 6;
  const tooLarge = data.length > MAX_FILE_SIZE;

  const rows = useMemo(() => {
    if (data.length === 0 || tooLarge) return [];
    const items: number[] = [];
    for (let addr = 0; addr < data.length; addr += bytesPerRow) items.push(addr);
    return items;
  }, [data, bytesPerRow, tooLarge]);

  const visibleRows = () => Math.max(1, Math.floor((vlApi.current?.viewportSize ?? 400) / rowHeight));

  /** Scroll so a byte is in view, keeping the list still while it already is */
  const reveal = useCallback(
    (index: number) => {
      const row = Math.floor(index / bytesPerRow);
      const start = vlApi.current?.findStartIndex() ?? 0;
      const count = Math.max(1, Math.floor((vlApi.current?.viewportSize ?? 400) / rowHeight));
      if (row >= start && row < start + count - 1) return;
      vlApi.current?.scrollToIndex(row < start ? row : Math.max(0, row - count + 2), { align: "start" });
    },
    [bytesPerRow, rowHeight]
  );

  const view = useByteView({ bytes: data, bytesPerRow, decimal: decimalView, reveal });

  if (data.length === 0) {
    return <EmptyState message={t("panels.doc.binViewer.noContent")} />;
  }
  if (tooLarge) {
    const sizeMb = (data.length / (1024 * 1024)).toLocaleString(uiLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return <EmptyState message={t("panels.doc.binViewer.tooLarge", { sizeMb, maxMb: 4 })} />;
  }

  const goTo = (text: string): string | undefined => {
    const value = parseGoToNumber(text, decimalView);
    if (value === undefined) return t("panels.memoryMap.goToError.number");
    if (value < 0 || value >= data.length) return t("panels.memoryMap.goToError.range");
    view.moveTo(value, false, false);
    vlApi.current?.scrollToIndex(Math.floor(value / bytesPerRow), { align: "start" });
    listRef.current?.focus({ preventScroll: true });
    return undefined;
  };

  return (
    <div className={frame.document}>
      <div className={frame.toolbar}>
        <GoToBox placeholder={t("panels.doc.binViewer.goToPlaceholder")} title={t("panels.doc.binViewer.goToTitle")} onGo={goTo} />
        <FindBox
          placeholder={t("panels.memoryView.findPlaceholder")}
          title={t("panels.memoryView.findBytesTitle")}
          text={view.find.text}
          count={view.find.matches?.length}
          index={view.find.index}
          invalid={view.find.invalid}
          onTextChange={view.setFindText}
          onSearch={view.runFind}
          onStep={view.stepFind}
        />
        <ToolGroup label={t("panels.memoryView.bytes")}>
          <Segmented
            label={t("panels.memoryView.bytes")}
            value={bytesPerRow}
            options={[
              { value: 8, text: "8" },
              { value: 16, text: "16" },
              { value: 32, text: "32" }
            ]}
            onChange={(v) => setBytesPerRow(v as BytesPerRow)}
          />
        </ToolGroup>
        <Segmented
          label={t("panels.memoryView.numberFormat")}
          value={decimalView ? "dec" : "hex"}
          options={[
            { value: "hex", text: t("panels.memoryView.hex"), title: t("panels.memoryView.hexTitle") },
            { value: "dec", text: t("panels.memoryView.dec"), title: t("panels.doc.binViewer.decimalTitle") }
          ]}
          onChange={(v) => setDecimalView(v === "dec")}
        />
        <Check label={t("panels.doc.binViewer.chars")} title={t("panels.doc.binViewer.charsTitle")} value={charDump} onChange={setCharDump} />
        <span className={frame.spacer} />
        <Check
          label={t("panels.memoryView.inspector")}
          title={t("panels.memoryView.inspectorTitle")}
          value={inspectorShown}
          onChange={setInspectorShown}
        />
      </div>
      <div className={classnames(frame.body, { [frame.bodyNoInspector]: !inspectorShown })}>
        <div
          className={frame.listing}
          ref={listRef}
          tabIndex={0}
          role="grid"
          aria-label={t("panels.memoryView.dump")}
          style={{ outline: "none" }}
          onKeyDown={(e) => {
            if (view.onKeyDown(e, visibleRows())) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <VirtualizedList
            items={rows}
            itemSize={rowHeight}
            revealUnmeasuredItems
            scrollRowsHorizontally
            apiLoaded={(api) => {
              vlApi.current = api;
            }}
            renderItem={(idx) => {
              const address = rows[idx];
              return (
                <DataRow index={idx} hoverable>
                  <MemoryDumpSection
                    address={address}
                    bytes={data.subarray(address, address + bytesPerRow) as unknown as readonly number[]}
                    decimalView={decimalView}
                    charDump={charDump}
                    lastJumpAddress={-1}
                    addressDigits={addressDigits}
                    marks={view.marksOf(address, Math.min(bytesPerRow, data.length - address))}
                    onBytePointer={(index, kind, extend) => {
                      listRef.current?.focus({ preventScroll: true });
                      view.onBytePointer(index, kind, extend);
                    }}
                  />
                </DataRow>
              );
            }}
          />
        </div>
        {inspectorShown && (
          <ByteInspector
            bytes={data}
            cursor={view.cursor}
            selection={view.selection}
            addressDigits={addressDigits}
            decimal={decimalView}
            onFindBytes={(pattern) => view.setFindText(pattern)}
          />
        )}
      </div>
    </div>
  );
};

export const createBinFileViewerPanel = ({ document, contents, apiLoaded }: DocumentProps) => (
  <BinFileViewerPanelComponent document={document} contents={contents} apiLoaded={apiLoaded} />
);
