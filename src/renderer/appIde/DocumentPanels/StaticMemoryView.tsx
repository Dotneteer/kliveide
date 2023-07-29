import classnames from "@renderer/utils/classnames";
import { DumpSection } from "./DumpSection";
import styles from "./StaticMemoryView.module.scss";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { useEffect, useState } from "react";
import { Label } from "@controls/Labels";

type MemoryViewProps = {
  memory: Uint8Array;
};

const MAX_BYTES = 64;

export const StaticMemoryView = ({ memory }: MemoryViewProps) => {
  const needsLabel = memory.length > MAX_BYTES;
  const [showAll, setShowAll] = useState(false);
  const [memoryItems, setMemoryItems] = useState<number[]>([]);

  useEffect(() => {
    const items: number[] = [];
    for (
      let addr = 0;
      addr < (showAll ? memory.length : Math.min(MAX_BYTES, memory.length));
      addr += 0x10
    ) {
      items.push(addr);
    }
    setMemoryItems(items);
  }, [memory, showAll]);

  return (
    <div className={styles.memoryView}>
      <div>
        {needsLabel && (
          <div className={styles.header}>
            <LabeledSwitch
              value={showAll}
              setterFn={setShowAll}
              label='Show all'
            />
            {needsLabel && !showAll && <Label text={`(Showing only the leading ${MAX_BYTES} bytes)`} />}
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
              <DumpSection key={mi} address={mi} memory={memory} charDump={true} />
              <DumpSection
                key={mi + 0x08} 
                address={mi + 0x08}
                memory={memory}
                charDump={true}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
