import classnames from "classnames";
import { MemoryDumpSection } from "@renderer/features/memory/MemoryDumpSection";
import styles from "./StaticMemoryView.module.scss";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { useEffect, useState } from "react";
import { Label } from "@renderer/controls/layout/Label";

type MemoryViewProps = {
  memory: Uint8Array;
  initialShowAll?: boolean
  maxBytesInConciseView?: number;
};

const MAX_BYTES = 64;

export const StaticMemoryView = ({ memory, initialShowAll = false, maxBytesInConciseView = MAX_BYTES }: MemoryViewProps) => {
  const needsLabel = memory.length > maxBytesInConciseView;
  const [showAll, setShowAll] = useState(initialShowAll);
  const [bytesDisplayed, setBytesDisplayed] = useState(0);
  const [memoryItems, setMemoryItems] = useState<number[]>([]);
  useEffect(() => {
    const items: number[] = [];
    const displayLength = showAll
      ? memory.length
      : Math.min(maxBytesInConciseView, memory.length);
    for (let addr = 0; addr < displayLength; addr += 0x10) {
      items.push(addr);
    }
    setMemoryItems(items);
    setBytesDisplayed(displayLength);
  }, [memory, showAll]);

  return (
    <div className={styles.memoryView}>
      <div>
        {needsLabel && (
          <div className={styles.header}>
            <LabeledSwitch
              value={showAll}
              label='Show all'
              clicked={v => setShowAll(v)}
            />
            {needsLabel && !showAll && (
              <Label text={`(Showing only the leading ${maxBytesInConciseView} bytes)`} />
            )}
          </div>
        )}
      </div>
      <div className={styles.memoryWrapper}>
        {memoryItems.map((mi, idx) => {
          return (
            <div
              key={mi}
              className={classnames(styles.item, {
                [styles.even]: idx % 2 == 0,
                [styles.twoSections]: true
              })}
            >
              <MemoryDumpSection
                key={mi}
                address={mi}
                bytes={memory.slice(mi, mi + 8)}
                decimalView={false}
                charDump={true}
                lastJumpAddress={-1}
              />
              {mi + 0x08 < bytesDisplayed && (
                <MemoryDumpSection
                  key={mi + 0x08}
                  address={mi + 0x08}
                  bytes={memory.slice(mi + 0x08, mi + 0x10)}
                  decimalView={false}
                  charDump={true}
                  lastJumpAddress={-1}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
