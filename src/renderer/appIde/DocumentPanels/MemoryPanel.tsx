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
import classnames from "@renderer/utils/classnames";
import { setIdeStatusMessageAction } from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEffect, useRef, useState } from "react";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./MemoryPanel.module.scss";
import { DumpSection } from "./DumpSection";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";
import { useDocumentHubService } from "../services/DocumentServiceProvider";
import { CachedRefreshState, MemoryBankBar, ViewMode } from "./MemoryBankBar";
import { machineRegistry } from "@common/machines/machine-registry";
import { MF_BANK, MF_ROM } from "@common/machines/constants";
import { MachineInfo } from "@common/machines/info-types";

type MemoryViewState = {
  topAddress?: number;
  twoColumns?: boolean;
  charDump?: boolean;
  autoRefresh?: boolean;
  viewMode?: ViewMode;
  romPage?: number;
  ramBank?: number;
};

const MemoryPanel = ({ viewState }: DocumentProps<MemoryViewState>) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const { messenger } = useRendererContext();
  const documentHubService = useDocumentHubService();

  // --- These states are part of the viewState
  const [topAddress, setTopAddress] = useState(
    (viewState?.topAddress ?? 0) * (viewState?.twoColumns ?? true ? 2 : 1)
  );
  const [twoColumns, setTwoColumns] = useState(viewState?.twoColumns ?? true);
  const [charDump, setCharDump] = useState(viewState?.charDump ?? true);
  const [autoRefresh, setAutoRefresh] = useState(
    viewState?.autoRefresh ?? false
  );
  const [viewMode, setViewMode] = useState(viewState?.viewMode ?? "full");
  const [romPage, setRomPage] = useState(viewState?.romPage ?? 0);
  const [ramBank, setRamBank] = useState(viewState?.ramBank ?? 0);
  const [bankInfo, setBankInfo] = useState(true);

  // --- These state variables store values for "rom" and "ram" views
  const [prevViewMode, setPrevViewMode] = useState<ViewMode>("rom");
  const [currentRomPage, setCurrentRomPage] = useState<number>();
  const [currentRamBank, setCurrentRamBank] = useState<number>();
  const partitionLabels = useRef<string[]>([]);

  // --- We need to use a reference to autorefresh, as we pass this info to another trhead
  const cachedRefreshState = useRef<CachedRefreshState>({
    autoRefresh,
    viewMode,
    romPage,
    ramBank
  });

  // --- Use these app state variables
  const machineState = useSelector(s => s.emulatorState?.machineState);
  const machineId = useSelector(s => s.emulatorState.machineId);
  const [romsNum, setRomsNum] = useState<number>(); 
  const [banksNum, setBanksNum] = useState<number>();
  const injectionVersion = useSelector(s => s.compilation?.injectionVersion);

  const refreshInProgress = useRef(false);
  const memory = useRef<Uint8Array>(new Uint8Array(0x1_0000));
  const [memoryItems, setMemoryItems] = useState<number[]>([]);
  const cachedItems = useRef<number[]>([]);
  const vlApi = useRef<VirtualizedListApi>(null);
  const [scrollVersion, setScrollVersion] = useState(0);
  const pointedRegs = useRef<Record<number, string>>({});
  const [showBankInfoOption, setShowBankInfoOption] = useState(false);

  // --- Respond to machine changes
  useEffect(() => {
    const machine = machineRegistry.find(mi => mi.machineId === machineId);
    const roms = machine.features?.[MF_ROM] ?? 1;
    const banks = machine.features?.[MF_BANK] ?? 0
    setRomsNum(roms);
    setBanksNum(banks);
    setShowBankInfoOption(roms + banks > 1);
  }, [machineId]);

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

      // --- Use partitions when multiple ROMs or Banks available
      if (cachedRefreshState.current.viewMode === "rom") {
        partition = -(cachedRefreshState.current.romPage + 1);
      } else if (cachedRefreshState.current.viewMode === "ram") {
        partition = cachedRefreshState.current.ramBank ?? 0;
      }

      // --- Get memory information
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
        partitionLabels.current = response.partitionLabels;

        // --- Calculate tooltips for pointed addresses
        pointedRegs.current = {};
        if (
          cachedRefreshState.current.viewMode !== "ram" &&
          (cachedRefreshState.current.autoRefresh ||
            machineState === MachineControllerState.Paused ||
            machineState === MachineControllerState.Stopped)
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

  // --- Save view state whenever view parameters change
  useEffect(() => {
    const mergedState: MemoryViewState = {
      topAddress,
      twoColumns,
      charDump,
      autoRefresh,
      viewMode,
      romPage,
      ramBank
    };
    documentHubService.saveActiveDocumentState(mergedState);
  }, [
    topAddress,
    twoColumns,
    charDump,
    autoRefresh,
    viewMode,
    romPage,
    ramBank
  ]);

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (!memoryItems.length) return;
    const idx = Math.floor(topAddress / (twoColumns ? 2 : 1));
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
      }
    })();
  }, [machineState]);

  // --- Change the length of the current dump section according to the view mode
  useEffect(
    () => createDumpSections(viewMode === "full" ? 0x1_0000 : 0x4000),
    [viewMode]
  );

  // --- Apply column number changes
  useEffect(() => {
    if (!twoColumns) {
      setTopAddress(topAddress * 2);
    }
    createDumpSections(memory.current.length);
    setScrollVersion(scrollVersion + 1);
  }, [twoColumns]);

  // --- Whenever the state of view options change
  useEffect(() => {
    cachedRefreshState.current = {
      autoRefresh,
      viewMode,
      romPage,
      ramBank
    };
    refreshMemoryView();
  }, [
    autoRefresh,
    twoColumns,
    charDump,
    injectionVersion,
    viewMode,
    romPage,
    ramBank
  ]);

  const refreshView = () => {
    if (cachedRefreshState.current.autoRefresh) {
      refreshMemoryView();
    }
  };

  // --- Take care of refreshing the screen
  useStateRefresh(500, refreshView);

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
          label='Auto Refresh:'
          title='Refresh the memory view periodically'
          clicked={setAutoRefresh}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={twoColumns}
          label='Two Columns:'
          title='Use two-column layout?'
          clicked={setTwoColumns}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={charDump}
          label='Char Dump:'
          title='Show characters dump?'
          clicked={setCharDump}
        />
        {showBankInfoOption && (
          <>
            <ToolbarSeparator small={true} />
            <LabeledSwitch
              value={bankInfo}
              label='Bank:'
              title='Display bank information?'
              clicked={setBankInfo}
            />
          </>
        )}

        <ToolbarSeparator small={true} />
        <AddressInput
          label='Go To:'
          onAddressSent={async address => {
            setTopAddress(Math.floor(address / 8));
            setScrollVersion(scrollVersion + 1);
          }}
        />
      </div>
      <MemoryBankBar
        viewMode={viewMode}
        prevViewMode={prevViewMode}
        romPages={romsNum}
        ramBanks={banksNum}
        currentRomPage={currentRomPage}
        currentRamBank={currentRamBank}
        selectedRomPage={romPage}
        selectedRamBank={ramBank}
        changed={args => {
          setViewMode(args.viewMode);
          setPrevViewMode(args.prevViewMode);
          setRomPage(args.romPage);
          setRamBank(args.ramBank);
        }}
      />
      <div className={styles.memoryWrapper}>
        <VirtualizedListView
          items={memoryItems}
          approxSize={20}
          fixItemHeight={true}
          scrolled={() => {
            if (!vlApi.current || cachedItems.current.length === 0) return;

            const range = vlApi.current.getRange();
            setTopAddress(range.startIndex);
          }}
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
                  showPartitions={bankInfo && showBankInfoOption}
                  partitionLabel={partitionLabels.current?.[memoryItems[idx] >> 13]}
                  address={memoryItems[idx]}
                  memory={memory.current}
                  charDump={charDump}
                  pointedInfo={pointedRegs.current}
                />
                {twoColumns && (
                  <DumpSection
                    showPartitions={bankInfo && showBankInfoOption}
                    partitionLabel={partitionLabels.current?.[memoryItems[idx] >> 13]}
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

export const createMemoryPanel = ({ document, viewState }: DocumentProps) => (
  <MemoryPanel document={document} viewState={viewState} apiLoaded={() => {}} />
);
