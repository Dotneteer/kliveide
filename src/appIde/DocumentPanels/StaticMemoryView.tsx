import classnames from "@/utils/classnames";
import { DumpSection } from "./DumpSection";
import styles from "./StaticMemoryView.module.scss";
import { useUncommittedState } from "@/core/useUncommittedState";
import { LabeledSwitch } from "@/controls/LabeledSwitch";

type MemoryViewProps = {
  memory: Uint8Array;
};

export const StaticMemoryView = ({ memory }: MemoryViewProps) => {
  // --- Get the services used in this component
  const needsLabel = memory.length > 64;
  memory = memory.slice(0, 64);
  const memoryItems: number[] = [];
  for (let addr = 0; addr < memory.length; addr += 0x10) {
    memoryItems.push(addr);
  }

  const [showAll, applyShowAll, setShowAll] = useUncommittedState(false);

  return (
    <div className={styles.memoryView}>
      <div>
        {needsLabel && (
          <LabeledSwitch
            value={showAll}
            setterFn={setShowAll}
            label='Show all'
          />
        )}
      </div>
      <div className={styles.memoryWrapper}>
        {memoryItems.map((mi, idx) => {
          return (
            <div
              className={classnames(styles.item, {
                [styles.even]: idx % 2 == 0,
                [styles.twoSections]: true
              })}
            >
              <DumpSection address={mi} memory={memory} charDump={true} />
              <DumpSection
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
