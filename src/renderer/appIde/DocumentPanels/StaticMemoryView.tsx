import { useCallback, useMemo, useRef, useState } from "react";
import { MemoryDumpSection } from "@renderer/features/memory/MemoryDumpSection";
import { DataRow } from "@renderer/controls/data";
import { Check } from "@renderer/features/memoryMap/FrameControls";
import { useByteView } from "@renderer/features/memoryMap/useByteView";
import { useT } from "@common/i18n/useT";
import styles from "./StaticMemoryView.module.scss";

/*
 * A compact byte preview inside another view: a disk sector, a file on a disk or in the File
 * Manager, a hard disk's file. It draws its rows as every other dump does since the Memory view's
 * redesign (`dev/ai/ui-theming-intent-and-lessons.md`, "Every hex dump uses the frame"): one
 * `MemoryDumpSection` per 16-byte row in a `DataRow`, and the shared cursor, selection and marks
 * (`useByteView`). It has no toolbar: only "Show all" when the bytes are more than the concise view
 * lists. It is not virtualized - it sits in its host's scrolling panel.
 */

type MemoryViewProps = {
  memory: Uint8Array;
  initialShowAll?: boolean;
  maxBytesInConciseView?: number;
};

const MAX_BYTES = 64;
const BYTES_PER_ROW = 16;

export const StaticMemoryView = ({
  memory,
  initialShowAll = false,
  maxBytesInConciseView = MAX_BYTES
}: MemoryViewProps) => {
  const t = useT();
  const needsShowAll = memory.length > maxBytesInConciseView;
  const [showAll, setShowAll] = useState(initialShowAll);
  const shown = showAll ? memory.length : Math.min(maxBytesInConciseView, memory.length);
  const bytes = useMemo(() => memory.subarray(0, shown), [memory, shown]);
  const rows = useMemo(() => {
    const starts: number[] = [];
    for (let address = 0; address < shown; address += BYTES_PER_ROW) starts.push(address);
    return starts;
  }, [shown]);
  // --- As the binary viewer: past 64K the offsets take the dashed six-digit form; the concise
  // --- view of a large file shows its first bytes with four
  const addressDigits: 4 | 6 = shown > 0x10000 ? 6 : 4;
  /** The cursor and selection show only once the preview is in use, not as noise in its host */
  const [active, setActive] = useState(false);

  const viewRef = useRef<HTMLDivElement>(null);
  const reveal = useCallback((index: number) => {
    const row = viewRef.current?.querySelector(`[data-row="${index - (index % BYTES_PER_ROW)}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
  }, []);
  const view = useByteView({ bytes, bytesPerRow: BYTES_PER_ROW, decimal: false, reveal });

  return (
    <div className={styles.memoryView}>
      {needsShowAll && (
        <div className={styles.header}>
          <Check label={t("panels.doc.staticMemory.showAll")} value={showAll} onChange={setShowAll} />
          {!showAll && (
            <span className={styles.note}>
              {t("panels.doc.staticMemory.showingLeading", { count: maxBytesInConciseView })}
            </span>
          )}
        </div>
      )}
      <div
        ref={viewRef}
        className={styles.rows}
        tabIndex={0}
        role="grid"
        aria-label={t("panels.memoryView.dump")}
        onFocus={() => setActive(true)}
        onKeyDown={(e) => {
          // --- The preview is short: a page is what is shown
          if (view.onKeyDown(e, rows.length)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {rows.map((address, idx) => (
          <div key={address} data-row={address}>
            <DataRow index={idx} hoverable>
              <MemoryDumpSection
                address={address}
                bytes={bytes.subarray(address, address + BYTES_PER_ROW) as unknown as readonly number[]}
                decimalView={false}
                charDump={true}
                lastJumpAddress={-1}
                addressDigits={addressDigits}
                marks={active ? view.marksOf(address, Math.min(BYTES_PER_ROW, shown - address)) : undefined}
                onBytePointer={(index, kind, extend) => {
                  viewRef.current?.focus({ preventScroll: true });
                  view.onBytePointer(index, kind, extend);
                }}
              />
            </DataRow>
          </div>
        ))}
      </div>
    </div>
  );
};
