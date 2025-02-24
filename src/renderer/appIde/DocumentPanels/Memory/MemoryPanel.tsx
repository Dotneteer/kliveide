import styles from "./MemoryPanel.module.scss";
import { useEffect, useRef, useState } from "react";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { setIdeStatusMessageAction } from "@common/state/actions";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { MF_BANK, MF_ROM, MF_ULA } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { AddressInput } from "@renderer/controls/AddressInput";
import { LabeledGroup } from "@renderer/controls/LabeledGroup";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import classnames from "classnames";
import { DumpSection } from "../DumpSection";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { useStateRefresh } from "@renderer/appIde/useStateRefresh";
import { LabeledText } from "@renderer/controls/generic/LabeledText";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { LabelSeparator } from "@renderer/controls/Labels";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
//import Switch from "react-switch";

type MemoryViewMode = "full" | "rom" | "ram" | "bank";

type BankedMemoryPanelViewState = {
  topIndex?: number;
  autoRefresh?: boolean;
  viewMode?: MemoryViewMode;
  prevViewMode?: MemoryViewMode;
  romPage?: number;
  ramBank?: number;
  twoColumns?: boolean;
  charDump?: boolean;
  bankLabel?: boolean;
};

export type CachedRefreshState = {
  autoRefresh: boolean;
  viewMode: MemoryViewMode;
  romPage: number;
  ramBank: number;
};

const BankedMemoryPanel = ({ document }: DocumentProps) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const emuApi = useEmuApi();

  // --- Get the machine information
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const machineId = useSelector((s) => s.emulatorState.machineId);
  const machineInfo = machineRegistry.find((mi) => mi.machineId === machineId);
  const romPages = machineInfo?.features?.[MF_ROM] ?? 0;
  const hasUla = machineInfo?.features?.[MF_ULA] ?? false;
  const showRoms = romPages > 0;
  const ramBanks = machineInfo?.features?.[MF_BANK] ?? 0;
  const showBanks = ramBanks > 0;
  const allowBankInput = ramBanks > 8;
  const allowViews = showBanks || showRoms;
  const headerRef = useRef<HTMLDivElement>(null);

  // --- Create a list of number range
  const range = (start: number, end: number) => {
    return [...Array(end - start + 1).keys()].map((i) => i + start);
  };

  // --- Read the view state of the document
  const viewState = useRef(
    (documentHubService.getDocumentViewState(document.id) as BankedMemoryPanelViewState) ?? {}
  );

  // --- View state variables
  const [topIndex, setTopIndex] = useState<number>(viewState.current?.topIndex ?? 0);
  const [autoRefresh, setAutoRefresh] = useState(viewState.current?.autoRefresh ?? true);
  const [viewMode, setViewMode] = useState<MemoryViewMode>(viewState.current?.viewMode ?? "full");
  const [prevViewMode, setPrevViewMode] = useState<MemoryViewMode>(
    viewState.current?.prevViewMode ?? "ram"
  );
  const [romPage, setRomPage] = useState<number>(viewState.current?.romPage ?? 0);
  const [ramBank, setRamBank] = useState<number>(viewState.current?.ramBank ?? 0);
  const [bankLabel, setBankLabel] = useState(viewState.current?.bankLabel ?? true);

  // --- ULA-related state
  const [currentRomPage, setCurrentRomPage] = useState<number>(0);
  const [currentRamBank, setCurrentRamBank] = useState<number>(0);

  // --- Display options
  const [twoColumns, setTwoColumns] = useState(viewState.current?.twoColumns ?? true);
  const [charDump, setCharDump] = useState(viewState.current?.charDump ?? true);

  // --- State of the memory view
  const refreshInProgress = useRef(false);
  const memory = useRef<Uint8Array>(new Uint8Array(0x1_0000));
  const [memoryItems, setMemoryItems] = useState<number[]>([]);
  const cachedItems = useRef<number[]>([]);
  const vlApi = useRef<VListHandle>(null);
  const partitionLabels = useRef<string[]>([]);
  const pointedRegs = useRef<Record<number, string>>({});
  const [scrollVersion, setScrollVersion] = useState(1);

  // --- We need to use a reference to autorefresh, as we pass this info to another trhead
  const cachedRefreshState = useRef<CachedRefreshState>({
    autoRefresh,
    viewMode,
    romPage,
    ramBank
  });

  // --- Save the current view state
  const saveViewState = () => {
    const mergedState: BankedMemoryPanelViewState = {
      topIndex: topIndex,
      autoRefresh,
      viewMode,
      prevViewMode,
      romPage,
      ramBank,
      twoColumns,
      charDump,
      bankLabel
    };
    documentHubService.saveActiveDocumentState(mergedState);
  };

  // --- Creates the addresses to represent dump sections
  const createDumpSections = (length: number, hasTwoColums: boolean) => {
    const memItems: number[] = [];
    for (let addr = 0; addr < length; addr += hasTwoColums ? 0x10 : 0x08) {
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
      const response = await emuApi.getMemoryContents(partition);

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
      createDumpSections(memory.current.length, twoColumns);

      // --- Obtain ULA information
      if (hasUla) {
        const ulaResponse = await emuApi.getUlaState();
        setCurrentRomPage(ulaResponse.romP);
        setCurrentRamBank(ulaResponse.ramB);
      }
    } finally {
      refreshInProgress.current = false;
      setScrollVersion(scrollVersion + 1);
    }

    function extendPointedAddress(regName: string, regValue: number): void {
      if (pointedRegs.current[regValue]) {
        pointedRegs.current[regValue] += ", " + regName;
      } else {
        pointedRegs.current[regValue] = regName;
      }
    }
  };

  // --- Save viewState changed
  useEffect(() => {
    saveViewState();
    cachedRefreshState.current = {
      autoRefresh,
      viewMode,
      romPage,
      ramBank
    };
  }, [
    topIndex,
    autoRefresh,
    viewMode,
    prevViewMode,
    romPage,
    ramBank,
    twoColumns,
    charDump,
    bankLabel
  ]);

  // --- Initial view: refresh the disassembly lint and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshMemoryView();
    setScrollVersion(scrollVersion + 1);
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (!memoryItems.length) return;
    vlApi.current?.scrollToIndex(Math.floor(topIndex), {
      align: "start"
    });
  }, [scrollVersion]);

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async () => {
      switch (machineState) {
        case MachineControllerState.Paused:
        case MachineControllerState.Stopped:
          refreshMemoryView();
      }
    })();
  }, [machineState]);

  // --- Change the length of the current dump section according to the view mode
  useEffect(
    () => createDumpSections(viewMode === "full" ? 0x1_0000 : 0x4000, twoColumns),
    [viewMode]
  );

  const refreshView = () => {
    if (cachedRefreshState.current.autoRefresh) {
      refreshMemoryView();
    }
  };

  // --- Take care of refreshing the screen
  useStateRefresh(500, refreshView);

  const OptionsBar = () => {
    return (
      <>
        <LabeledSwitch
          value={twoColumns}
          label="Two Columns:"
          title="Use two-column layout?"
          clicked={(v) => {
            setTwoColumns(v);
            createDumpSections(memory.current.length, v);
            if (v) {
              setTopIndex(Math.floor(topIndex / 2));
            } else {
              setTopIndex(topIndex * 2);
            }
            setScrollVersion(scrollVersion + 1);
          }}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={charDump}
          label="Char Dump:"
          title="Show characters dump?"
          clicked={setCharDump}
        />
        {allowViews && (
          <>
            <ToolbarSeparator small={true} />
            <LabeledSwitch
              value={bankLabel}
              label="Bank Label:"
              title="Display bank label information?"
              clicked={setBankLabel}
            />
          </>
        )}
      </>
    );
  };

  return (
    <div className={styles.panel}>
      <div ref={headerRef} className={styles.header} tabIndex={-1}>
        <LabelSeparator width={4} />
        <LabeledText label="Display:" value={`0000-${viewMode === "full" ? "FFFF" : "3FFF"}`} />
        <ToolbarSeparator small={true} />
        <AddressInput
          label="Go To:"
          clearOnEnter={true}
          onAddressSent={async (address) => {
            setTopIndex(Math.floor(address / (twoColumns ? 16 : 8)));
            setScrollVersion(scrollVersion + 1);
          }}
        />
        <LabelSeparator width={8} />
        <ToolbarSeparator small={true} />
        <SmallIconButton
          iconName="refresh"
          title={"Refresh now"}
          clicked={async () => {
            refreshMemoryView();
            dispatch(setIdeStatusMessageAction("Memory view refreshed", true));
          }}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={autoRefresh}
          label="Auto Refresh:"
          title="Refresh the memory view periodically"
          clicked={setAutoRefresh}
        />
        {allowViews && (
          <>
            <ToolbarSeparator small={true} />
            <LabeledSwitch
              value={viewMode === "full"}
              label="64K View"
              title="Show the full 64K memory"
              clicked={(v) => {
                setViewMode(v ? "full" : prevViewMode);
                setPrevViewMode(v ? viewMode : "full");
              }}
            />
            {allowBankInput && viewMode !== "full" && (
              <>
                <ToolbarSeparator small={true} />
                <AddressInput
                  label="Bank:"
                  eightBit={true}
                  clearOnEnter={false}
                  initialValue={ramBank}
                  onAddressSent={async (bank) => {
                    setViewMode("ram");
                    setPrevViewMode(viewMode);
                    setRamBank(bank);
                    if (headerRef.current) headerRef.current.focus();
                    cachedRefreshState.current = {
                      autoRefresh,
                      viewMode: "ram",
                      romPage,
                      ramBank: bank
                    };
                    await refreshMemoryView();
                    setScrollVersion(scrollVersion + 1);
                  }}
                />
              </>
            )}
            {showRoms && viewMode !== "full" && (
              <>
                <ToolbarSeparator small={true} />
                <LabeledGroup
                  label="ROM: "
                  title="Select the ROM to display"
                  values={range(0, romPages - 1)}
                  marked={currentRomPage}
                  selected={viewMode === "rom" ? romPage : -1}
                  clicked={(v) => {
                    setViewMode("rom");
                    setPrevViewMode(viewMode);
                    setRomPage(v);
                  }}
                />
                <ToolbarSeparator small={true} />
                <LabeledGroup
                  label="RAM Bank: "
                  title="Select the RAM Bank to display"
                  values={range(0, ramBanks - 1)}
                  marked={currentRamBank}
                  selected={viewMode === "ram" ? ramBank : -1}
                  clicked={(v) => {
                    setViewMode("ram");
                    setPrevViewMode(viewMode), setRamBank(v);
                  }}
                />
              </>
            )}
          </>
        )}
        {!allowViews && (
          <>
            <ToolbarSeparator small={true} />
            <OptionsBar />
          </>
        )}
      </div>
      {allowViews && (
        <div className={styles.header}>
          <OptionsBar />
        </div>
      )}
      <div className={styles.headerSeparator} />
      <div className={styles.memoryWrapper}>
        <VirtualizedList
          items={memoryItems}
          overscan={25}
          onScroll={() => {
            if (!vlApi.current || cachedItems.current.length === 0) return;
            setTopIndex(vlApi.current.findStartIndex());
          }}
          apiLoaded={(api) => (vlApi.current = api)}
          renderItem={(idx) => {
            return (
              <div
                className={classnames(styles.item, {
                  [styles.even]: idx % 2 == 0,
                  [styles.twoSections]: twoColumns
                })}
              >
                <DumpSection
                  showPartitions={showBanks && bankLabel}
                  partitionLabel={
                    viewMode !== "full"
                      ? toHexa2(ramBank)
                      : partitionLabels.current?.[memoryItems[idx] >> 13]
                  }
                  address={memoryItems[idx]}
                  memory={memory.current}
                  charDump={charDump}
                  pointedInfo={pointedRegs.current}
                />
                {twoColumns && (
                  <DumpSection
                    showPartitions={showBanks && bankLabel}
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

export const createMemoryPanel = ({ document, contents }: DocumentProps) => (
  <BankedMemoryPanel document={document} contents={contents} apiLoaded={() => {}} />
);
