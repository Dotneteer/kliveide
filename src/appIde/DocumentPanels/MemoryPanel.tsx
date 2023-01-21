import { SmallIconButton } from "@/controls/common/IconButton";
import { LabeledSwitch } from "@/controls/common/LabeledSwitch";
import {
  Label,
  LabelSeparator,
  Secondary,
  Value
} from "@/controls/common/Labels";
import { ToolbarSeparator } from "@/controls/common/ToolbarSeparator";
import { VirtualizedListApi } from "@/controls/common/VirtualizedList";
import { VirtualizedListView } from "@/controls/common/VirtualizedListView";
import { useRendererContext, useSelector } from "@/core/RendererProvider";
import classnames from "@/utils/classnames";
import { EmuGetMemoryResponse } from "@messaging/main-to-emu";
import { MachineControllerState } from "@state/MachineControllerState";
import createStatsCollector from "mocha/lib/stats-collector";
import { useEffect, useRef, useState } from "react";
import { toHexa4 } from "../services/interactive-commands";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./MemoryPanel.module.scss";

const MemoryPanel = () => {
  const { messenger } = useRendererContext();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const useAutoRefresh = useRef(false);
  const initialized = useRef(false);
  const [twoSections, setTwoSections] = useState(true);
  const [charDump, setCharDump] = useState(true);
  const machineState = useSelector(s => s.emulatorState?.machineState);
  const memory = useRef<Uint8Array>();
  const [memoryItems, setMemoryItems] = useState<number[]>([]);
  const [pausedPc, setPausedPc] = useState(0);
  const vlApi = useRef<VirtualizedListApi>(null);
  const refreshedOnStateChange = useRef(false);

  // --- Creates the addresses to represent dump sections
  const createDumpSections = () => {
    const memItems: number[] = [];
    for (let addr = 0; addr < 0x1_0000; addr += twoSections ? 0x10 : 0x08) {
      memItems.push(addr);
    }
    setMemoryItems(memItems);
  };

  // --- This function refreshes the memory
  const refreshMemoryView = async () => {
    // --- Obtain the memory contents
    const response = (await messenger.sendMessage({
      type: "EmuGetMemory"
    })) as EmuGetMemoryResponse;
    memory.current = response.memory;
    createDumpSections();
  };

  // --- Initial view
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    refreshMemoryView();
  });

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async function () {
      switch (machineState) {
        case MachineControllerState.Paused:
        case MachineControllerState.Stopped:
          await refreshMemoryView();
          refreshedOnStateChange.current = true;
      }
    })();
  }, [machineState]);

  // --- Whenever the state of view options change
  useEffect(() => {
    (async function () {
      await refreshMemoryView();
    })();
  }, [twoSections, pausedPc]);

  // --- Take care of refreshing the screen
  useStateRefresh(500, () => {
    if (useAutoRefresh.current || refreshedOnStateChange.current) {
      refreshMemoryView();
      refreshedOnStateChange.current = false;
    }
  });

  // --- Whenever two-section mode changes, refresh sections
  useEffect(() => {
    createDumpSections();
  }, [twoSections]);

  return (
    <div className={styles.memoryPanel}>
      <div className={styles.header}>
        <SmallIconButton iconName='refresh' title={"Refresh now"} />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={autoRefresh}
          setterFn={setAutoRefresh}
          label='Auto Refresh:'
          title='Refresh the memory view periodically'
          clicked={val => (useAutoRefresh.current = val)}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={twoSections}
          setterFn={setTwoSections}
          label='Two Sections:'
          title='Use two-column layout?'
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={charDump}
          setterFn={setCharDump}
          label='Char Dump:'
          title='Show characters dump?'
        />
      </div>
      <div className={styles.memoryWrapper}>
        <VirtualizedListView
          items={memoryItems}
          approxSize={20}
          fixItemHeight={false}
          apiLoaded={api => (vlApi.current = api)}
          itemRenderer={idx => {
            return (
              <div
                className={classnames(styles.item, {
                  [styles.even]: idx % 2 == 0,
                  [styles.twoSections]: twoSections
                })}
              >
                <DumpSection
                  address={memoryItems[idx]}
                  memory={memory.current}
                  charDump={charDump}
                />
                {twoSections && (
                  <DumpSection
                    address={memoryItems[idx] + 0x08}
                    memory={memory.current}
                    charDump={charDump}
                  />
                )}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};

type DumpProps = {
  address: number;
  memory: Uint8Array;
  charDump: boolean;
};

const DumpSection = ({ address, memory, charDump }: DumpProps) => {
  return (
    <div className={styles.dumpSection}>
      <LabelSeparator width={8} />
      <Label text={toHexa4(address)} />
      <LabelSeparator width={8} />
      <Value text='00 11 22 33 44 55 66 77' />
      <LabelSeparator width={8} />
      {charDump && <Secondary text='.Q.Q.Q.Q' />}
    </div>
  );
};

export const createMemoryPanel = () => <MemoryPanel />;
