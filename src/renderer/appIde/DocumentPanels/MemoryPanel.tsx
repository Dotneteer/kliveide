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
import { setIdeStatusMessageAction } from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { memo, useEffect, useRef, useState } from "react";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { useAppServices } from "../services/AppServicesProvider";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./MemoryPanel.module.scss";
import { DumpSection } from "./DumpSection";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";
import { LabeledGroup } from "@renderer/controls/LabeledGroup";

type MemoryViewState = {
  topAddress?: number;
  twoColumns?: boolean;
  charDump?: boolean;
  autoRefresh?: boolean;
  fullView?: boolean;
  romSelected?: number;
  ramSelected?: number;
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
  const machineId = useSelector(s => s.emulatorState.machineId);
  const injectionVersion = useSelector(s => s.compilation?.injectionVersion);

  // --- Get the services used in this component
  const dispatch = useDispatch();
  const { messenger } = useRendererContext();
  const { documentService } = useAppServices();

  // --- Use these options to set memory options. As memory view is async, we sometimes
  // --- need to use state changes not yet committed by React.
  const [autoRefresh, refAutoRefresh, setAutoRefresh] = useUncommittedState(
    viewState.current?.autoRefresh ?? false
  );
  const [twoColumns, refTwoColumns, setTwoColumns] = useUncommittedState(
    viewState.current?.twoColumns ?? true
  );
  const [charDump, refCharDump, setCharDump] = useUncommittedState(
    viewState.current?.charDump ?? true
  );

  // --- Use these options to set memory options. As memory view is async, we sometimes
  // --- need to use state changes not yet committed by React.
  const [fullView, refFullView, setFullView] = useUncommittedState(
    viewState.current?.fullView ?? true
  );
  const [romPage, refRomPage, setRomPage] = useUncommittedState(
    viewState.current?.romSelected ?? null
  );
  const [ramBank, refRamBank, setRamBank] = useUncommittedState(
    viewState.current?.ramSelected ?? null
  );
  const [currentRomPage, setCurrentRomPage] = useState<number>();
  const [currentRamBank, setCurrentRamBank] = useState<number>();
  const [lastRomPage, setLastRomPage] = useState<number>(null);
  const [lastRamBank, setLastRamBank] = useState<number>(null);

  const refreshInProgress = useRef(false);
  const memory = useRef<Uint8Array>(new Uint8Array(0x1_0000));
  const [memoryItems, setMemoryItems] = useState<number[]>([]);
  const cachedItems = useRef<number[]>([]);
  const vlApi = useRef<VirtualizedListApi>(null);
  const refreshedOnStateChange = useRef(false);
  const [scrollVersion, setScrollVersion] = useState(0);
  const pointedRegs = useRef<Record<number, string>>({});

  // --- Creates the addresses to represent dump sections
  const createDumpSections = (length: number) => {
    const memItems: number[] = [];
    for (let addr = 0; addr < length; addr += twoColumns ? 0x10 : 0x08) {
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
      let partition: number | undefined;
      if (!fullView) {
        if (romPage != undefined) {
          partition = -(romPage + 1);
        } else {
          partition = ramBank ?? 0;
        }
      }
      const response = await messenger.sendMessage({
        type: "EmuGetMemory",
        partition
      });
      if (response.type === "ErrorResponse") {
        reportMessagingError(
          `EmuGetMemory request failed: ${response.message}`
        );
      } else if (response.type !== "EmuGetMemoryResponse") {
        reportUnexpectedMessageType(response.type);
      } else {
        memory.current = response.memory;

        // --- Calculate tooltips for pointed addresses
        pointedRegs.current = {};
        if (
          refAutoRefresh.current ||
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
        createDumpSections(memory.current.length);

        // --- Obtain ULA information
        const ulaResponse = await messenger.sendMessage({
          type: "EmuGetUlaState"
        });
        if (ulaResponse.type === "ErrorResponse") {
          reportMessagingError(
            `EmuGetUlaState request failed: ${ulaResponse.message}`
          );
        } else if (ulaResponse.type !== "EmuGetUlaStateResponse") {
          reportUnexpectedMessageType(ulaResponse.type);
        } else {
          setCurrentRomPage(ulaResponse.romP);
          setCurrentRamBank(ulaResponse.ramB);
        }
      }
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
      topAddress.current / (refTwoColumns.current ? 2 : 1)
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
  }, [autoRefresh, charDump, injectionVersion, fullView, romPage, ramBank]);

  // --- Take care of refreshing the screen
  useStateRefresh(500, () => {
    if (refAutoRefresh.current || refreshedOnStateChange.current) {
      refreshMemoryView();
      refreshedOnStateChange.current = false;
    }
  });

  // --- Whenever two-section mode changes, refresh sections
  useEffect(() => {
    createDumpSections(memory.current.length);
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
      twoColumns: refTwoColumns.current,
      charDump: refCharDump.current,
      autoRefresh: refAutoRefresh.current,
      fullView: refFullView.current,
      romSelected: refRomPage.current,
      ramSelected: refRamBank.current
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
            if (!refTwoColumns.current) {
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
        <ToolbarSeparator small={true} />
        <AddressInput
          label='Go To:'
          onAddressSent={async address => {
            topAddress.current = Math.floor(address / 8);
            setScrollVersion(scrollVersion + 1);
          }}
        />
      </div>
      {machineId === "sp128" && (
        <div className={styles.header}>
          <LabeledSwitch
            value={fullView}
            setterFn={setFullView}
            label='Full View:'
            title='Show the full 64K memory'
            clicked={() => {
              if (refFullView.current) {
                setRomPage(null);
                setRamBank(null);
              } else {
                if (lastRomPage === null && lastRamBank === null) {
                  setRomPage(0);
                } else {
                  setRomPage(lastRomPage);
                  setRamBank(lastRamBank);
                }
              }
              saveViewState();
            }}
          />
          <ToolbarSeparator small={true} />
          <LabeledGroup
            label='ROM: '
            title='Select the ROM to display'
            values={[0, 1]}
            marked={currentRomPage}
            selected={romPage}
            clicked={v => {
              setRomPage(v);
              setLastRomPage(v);
              setRamBank(null);
              setLastRamBank(null);
              setFullView(false);
              saveViewState();
            }}
          />
          <ToolbarSeparator small={true} />
          <LabeledGroup
            label='RAM Bank: '
            title='Select the RAM Bank to display'
            values={[0, 1, 2, 3, 4, 5, 6, 7]}
            marked={currentRamBank}
            selected={ramBank}
            clicked={v => {
              setRamBank(v);
              setLastRamBank(v);
              setRomPage(null);
              setLastRomPage(null);
              setFullView(false);
              saveViewState();
            }}
          />
        </div>
      )}
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
  <MemoryPanel document={document} apiLoaded={() => {}}/>
);
