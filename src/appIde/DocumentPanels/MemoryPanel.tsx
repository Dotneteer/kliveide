import { SmallIconButton } from "@/controls/common/IconButton";
import { LabeledSwitch } from "@/controls/common/LabeledSwitch";
import { Label, LabelSeparator } from "@/controls/common/Labels";
import { ToolbarSeparator } from "@/controls/common/ToolbarSeparator";
import { TooltipFactory } from "@/controls/common/Tooltip";
import { VirtualizedListApi } from "@/controls/common/VirtualizedList";
import { VirtualizedListView } from "@/controls/common/VirtualizedListView";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@/core/RendererProvider";
import { useInitializeAsync } from "@/core/useInitializeAsync";
import { useUncommittedState } from "@/core/useUncommittedState";
import classnames from "@/utils/classnames";
import { EmuGetMemoryResponse } from "@messaging/main-to-emu";
import { setIdeStatusMessageAction } from "@state/actions";
import { MachineControllerState } from "@state/MachineControllerState";
import { useEffect, useRef, useState } from "react";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { useAppServices } from "../services/AppServicesProvider";
import { toHexa2, toHexa4 } from "../services/interactive-commands";
import { useStateRefresh } from "../useStateRefresh";
import { ZxSpectrumChars } from "./char-codes";
import styles from "./MemoryPanel.module.scss";

type MemoryViewState = {
  topAddress?: number;
  twoColumns?: boolean;
  charDump?: boolean;
  autoRefresh?: boolean;
};

const MemoryPanel = ({ document }: DocumentProps) => {
  // --- Read the view state of the document
  const viewState = useRef((document.stateValue as MemoryViewState) ?? {});
  const topAddress = useRef(
    (viewState.current?.topAddress ?? 0) *
      (viewState.current?.twoColumns ?? true ? 2 : 1)
  );

  // --- Use these app state variables
  const machineState = useSelector(s => s.emulatorState?.machineState);

  // --- Get the services used in this component
  const dispatch = useDispatch();
  const { messenger } = useRendererContext();
  const { documentService } = useAppServices();

  // --- Use these options to set memory options. As memory view is async, we sometimes
  // --- need to use state changes not yet committed by React.
  const [autoRefresh, useAutoRefresh, setAutoRefresh] = useUncommittedState(
    viewState.current?.autoRefresh ?? false
  );
  const [twoColumns, useTwoColumns, setTwoColumns] = useUncommittedState(
    viewState.current?.twoColumns ?? true
  );
  const [charDump, useCharDump, setCharDump] = useUncommittedState(
    viewState.current?.charDump ?? true
  );

  const refreshInProgress = useRef(false);
  const memory = useRef<Uint8Array>(new Uint8Array(0x1_0000));
  const [memoryItems, setMemoryItems] = useState<number[]>([]);
  const cachedItems = useRef<number[]>([]);
  const vlApi = useRef<VirtualizedListApi>(null);
  const refreshedOnStateChange = useRef(false);
  const [scrollVersion, setScrollVersion] = useState(0);

  // --- Creates the addresses to represent dump sections
  const createDumpSections = () => {
    const memItems: number[] = [];
    for (let addr = 0; addr < 0x1_0000; addr += twoColumns ? 0x10 : 0x08) {
      memItems.push(addr);
    }
    cachedItems.current = memItems;
    setMemoryItems(memItems);
  };

  // --- This function refreshes the memory
  const refreshMemoryView = async () => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    try {
      // --- Obtain the memory contents
      const response = (await messenger.sendMessage({
        type: "EmuGetMemory"
      })) as EmuGetMemoryResponse;
      memory.current = response.memory;
      createDumpSections();
    } finally {
      refreshInProgress.current = false;
    }
  };

  // --- Initial view: refresh the disassembly lint and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshMemoryView();
    setScrollVersion(scrollVersion + 1);
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (!memoryItems.length) return;
    const idx = Math.floor(
      topAddress.current / (useTwoColumns.current ? 2 : 1)
    );
    vlApi.current?.scrollToIndex(idx, {
      align: "start"
    });
  }, [scrollVersion]);

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
    refreshMemoryView();
  }, [autoRefresh, charDump]);

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
  }, [twoColumns]);

  // --- Save the current top addresds
  const storeTopAddress = () => {
    const range = vlApi.current.getRange();
    topAddress.current = range.startIndex;
  };

  // --- Save the new view state whenever the view is scrolled
  const scrolled = () => {
    if (!vlApi.current || cachedItems.current.length === 0) return;

    storeTopAddress();
    saveViewState();
  };

  // --- Save the current view state
  const saveViewState = () => {
    const mergedState: MemoryViewState = {
      topAddress: topAddress.current,
      twoColumns: useTwoColumns.current,
      charDump: useCharDump.current,
      autoRefresh: useAutoRefresh.current
    };
    documentService.saveActiveDocumentState(mergedState);
  };

  return (
    <div className={styles.memoryPanel}>
      <div className={styles.header}>
        <SmallIconButton
          iconName='refresh'
          title={"Refresh now"}
          clicked={async () => {
            refreshMemoryView();
            dispatch(setIdeStatusMessageAction("Memory view refreshed", true));
          }}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={autoRefresh}
          setterFn={setAutoRefresh}
          label='Auto Refresh:'
          title='Refresh the memory view periodically'
          clicked={() => saveViewState()}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={twoColumns}
          setterFn={setTwoColumns}
          label='Two Columns:'
          title='Use two-column layout?'
          clicked={() => {
            if (!useTwoColumns.current) {
              topAddress.current *= 2;
            }
            saveViewState();
            setScrollVersion(scrollVersion + 1);
          }}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={charDump}
          setterFn={setCharDump}
          label='Char Dump:'
          title='Show characters dump?'
          clicked={() => saveViewState()}
        />
      </div>
      <div className={styles.memoryWrapper}>
        <VirtualizedListView
          items={memoryItems}
          approxSize={20}
          fixItemHeight={false}
          scrolled={scrolled}
          apiLoaded={api => (vlApi.current = api)}
          itemRenderer={idx => {
            return (
              <div
                className={classnames(styles.item, {
                  [styles.even]: idx % 2 == 0,
                  [styles.twoSections]: twoColumns
                })}
              >
                <DumpSection
                  address={memoryItems[idx]}
                  memory={memory.current}
                  charDump={charDump}
                />
                {twoColumns && (
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
  const title = `Value at $${toHexa4(address)} (${address}):\n${
    tooltipCache[value]
  }`;
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
  const title = `Value at $${toHexa4(address)} (${address}):\n${
    tooltipCache[value]
  }`;
  value;
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

export const createMemoryPanel = ({ document }: DocumentProps) => (
  <MemoryPanel document={document} />
);

// --- Cache tooltip value
const tooltipCache: string[] = [];
for (let i = 0; i < 0x100; i++) {
  const valueInfo = ZxSpectrumChars[i];
  let description = valueInfo.t ?? "";
  if (valueInfo.c === "graph") {
    description = "(graphics)";
  } else if (valueInfo.c) {
    description = valueInfo.t ?? "";
  }
  tooltipCache[i] =
    `$${toHexa2(i)} (${i}, %${i.toString(2)})\n` +
    `${valueInfo.v ? valueInfo.v + " " : ""}${description}`;
}
