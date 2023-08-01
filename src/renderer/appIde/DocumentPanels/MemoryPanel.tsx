import { AddressInput } from "@controls/AddressInput";
import { SmallIconButton } from "@controls/IconButton";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { ToolbarSeparator } from "@controls/ToolbarSeparator";
import { VirtualizedListApi } from "@controls/VirtualizedList";
import { VirtualizedListView } from "@controls/VirtualizedListView";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { useUncommittedState } from "@renderer/core/useUncommittedState";
import classnames from "@renderer/utils/classnames";
import { EmuGetMemoryResponse } from "@messaging/main-to-emu";
import { setIdeStatusMessageAction } from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEffect, useRef, useState } from "react";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { useAppServices } from "../services/AppServicesProvider";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./MemoryPanel.module.scss";
import { DumpSection } from "./DumpSection";

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
  const pointedRegs = useRef<Record<number, string>>({});

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

      // --- Calculate tooltips for pointed addresses
      pointedRegs.current = {};
      if (
        useAutoRefresh.current ||
        machineState === MachineControllerState.Paused ||
        machineState === MachineControllerState.Stopped
      ) {
        extendPointedAddress("AF", response.af);
        extendPointedAddress("BC", response.bc);
        extendPointedAddress("DE", response.de);
        extendPointedAddress("HL", response.hl);
        extendPointedAddress("AF'", response.af_);
        extendPointedAddress("BC'", response.bc_);
        extendPointedAddress("DE'", response.de_);
        extendPointedAddress("HL'", response.hl_);
        extendPointedAddress("PC", response.pc);
        extendPointedAddress("SP", response.sp);
        extendPointedAddress("IX", response.ix);
        extendPointedAddress("IY", response.iy);
        extendPointedAddress("IR", response.ir);
        extendPointedAddress("WZ", response.sp);
      }
      createDumpSections();
    } finally {
      refreshInProgress.current = false;
    }

    function extendPointedAddress (regName: string, regValue: number): void {
      if (pointedRegs.current[regValue]) {
        pointedRegs.current[regValue] += ", " + regName;
      } else {
        pointedRegs.current[regValue] = regName;
      }
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
        <AddressInput label="Go To:" onAddressSent={async (address) => {
          topAddress.current = Math.floor(address/8);
          setScrollVersion(scrollVersion + 1);
        }}/>

      </div>
      <div className={styles.memoryWrapper}>
        <VirtualizedListView
          items={memoryItems}
          approxSize={20}
          fixItemHeight={false}
          scrolled={scrolled}
          vlApiLoaded={api => (vlApi.current = api)}
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
                  pointedInfo={pointedRegs.current}
                />
                {twoColumns && (
                  <DumpSection
                    address={memoryItems[idx] + 0x08}
                    memory={memory.current}
                    pointedInfo={pointedRegs.current}
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

export const createMemoryPanel = ({ document }: DocumentProps) => (
  <MemoryPanel document={document} />
);