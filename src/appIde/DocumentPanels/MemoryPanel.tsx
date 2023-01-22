import { SmallIconButton } from "@/controls/common/IconButton";
import { LabeledSwitch } from "@/controls/common/LabeledSwitch";
import {
  Label,
  LabelSeparator,
  Secondary,
  Value
} from "@/controls/common/Labels";
import { ToolbarSeparator } from "@/controls/common/ToolbarSeparator";
import { TooltipFactory } from "@/controls/common/Tooltip";
import { VirtualizedListApi } from "@/controls/common/VirtualizedList";
import { VirtualizedListView } from "@/controls/common/VirtualizedListView";
import { useRendererContext, useSelector } from "@/core/RendererProvider";
import classnames from "@/utils/classnames";
import { EmuGetMemoryResponse } from "@messaging/main-to-emu";
import { MachineControllerState } from "@state/MachineControllerState";
import createStatsCollector from "mocha/lib/stats-collector";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toHexa2, toHexa4 } from "../services/interactive-commands";
import { useStateRefresh } from "../useStateRefresh";
import { ZxSpectrumChars } from "./char-codes";
import styles from "./MemoryPanel.module.scss";

const MemoryPanel = () => {
  const { messenger } = useRendererContext();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const useAutoRefresh = useRef(false);
  const refreshInProgress = useRef(false);
  const initialized = useRef(false);
  const [twoSections, setTwoSections] = useState(true);
  const [charDump, setCharDump] = useState(true);
  const machineState = useSelector(s => s.emulatorState?.machineState);
  const memory = useRef<Uint8Array>(new Uint8Array(0x1_0000));
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
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    try {
      // --- Obtain the memory contents
      //memory.current = new Uint8Array(0x1_0000);
      const response = (await messenger.sendMessage({
        type: "EmuGetMemory"
      })) as EmuGetMemoryResponse;
      memory.current = response.memory;
      createDumpSections();
    } finally {
      refreshInProgress.current = false;
    }
  };

  // --- Initial view
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => await refreshMemoryView())();
  });

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async () => {
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
    (async () => {
      await refreshMemoryView();
    })();
  }, [pausedPc]);

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
        <SmallIconButton
          iconName='refresh'
          title={"Refresh now"}
          clicked={() => refreshMemoryView()}
        />
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
  if (!memory) return null;

  return (
    <div className={styles.dumpSection}>
      <LabelSeparator width={8} />
      <Label text={toHexa4(address)} width={40} />
      <ByteValue address={address + 0} value={memory[address + 0]} />
      <ByteValue address={address + 1} value={memory[address + 1]} />
      <ByteValue address={address + 2} value={memory[address + 2]} />
      <ByteValue address={address + 3} value={memory[address + 3]} />
      <ByteValue address={address + 4} value={memory[address + 4]} />
      <ByteValue address={address + 5} value={memory[address + 5]} />
      <ByteValue address={address + 6} value={memory[address + 6]} />
      <ByteValue address={address + 7} value={memory[address + 7]} />
      <LabelSeparator width={8} />
      {charDump && (
        <>
          <CharValue address={address + 0} value={memory[address + 0]} />
          <CharValue address={address + 1} value={memory[address + 1]} />
          <CharValue address={address + 2} value={memory[address + 2]} />
          <CharValue address={address + 3} value={memory[address + 3]} />
          <CharValue address={address + 4} value={memory[address + 4]} />
          <CharValue address={address + 5} value={memory[address + 5]} />
          <CharValue address={address + 6} value={memory[address + 6]} />
          <CharValue address={address + 7} value={memory[address + 7]} />
          <LabelSeparator width={8} />
        </>
      )}
    </div>
  );
};

type ByteValueProps = {
  address: number;
  value: number;
};

const ByteValue = ({ address, value }: ByteValueProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const title = `Value at $${toHexa4(address)} (${address}):\n$${toHexa2(
    value
  )} (${value}, %${value.toString(2)}) `;
  const toolTipLines = (title ?? "").split("\n");
  return (
    <div ref={ref} className={styles.value}>
      {toHexa2(value)}
      {title && (
        <TooltipFactory
          refElement={ref.current}
          placement='bottom'
          offsetX={0}
          offsetY={16}
          showDelay={100}
        >
          {toolTipLines.map((l, idx) => (
            <div key={idx}>{l}</div>
          ))}
        </TooltipFactory>
      )}
    </div>
  );
};

const CharValue = ({ address, value }: ByteValueProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const valueInfo = ZxSpectrumChars[value & 0xff];
  let text = valueInfo.v ?? ".";
  let description = valueInfo.t ?? "";
  if (valueInfo.c === "graph") {
    description = "(graphics)";
  } else if (valueInfo.c) {
    description = valueInfo.t ?? "";
  }
  const title = `Char at $${toHexa4(address)} (${address}):\n$${toHexa2(
    value
  )}, ${valueInfo.v ? valueInfo.v + " " : ""}${description}`;
  const toolTipLines = (title ?? "").split("\n");
  return (
    <div ref={ref} className={styles.char}>
      {text}
      {title && (
        <TooltipFactory
          refElement={ref.current}
          placement='bottom'
          offsetX={0}
          offsetY={16}
          showDelay={100}
        >
          {toolTipLines.map((l, idx) => (
            <div key={idx}>{l}</div>
          ))}
        </TooltipFactory>
      )}
    </div>
  );
};

export const createMemoryPanel = () => <MemoryPanel />;
