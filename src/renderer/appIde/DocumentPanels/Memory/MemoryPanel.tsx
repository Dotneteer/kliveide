import { memo, useEffect, useMemo, useRef, useState } from "react";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { MF_BANK, MF_ROM, MI_Z88, MI_ZXNEXT } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { AddressInput } from "@renderer/controls/AddressInput";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { DumpSection } from "../DumpSection";
import { LabelSeparator } from "@renderer/controls/Labels";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import { FullPanel, HStack } from "@renderer/controls/new/Panels";
import { PanelHeader } from "../helpers/PanelHeader";
import Dropdown, { DropdownOption } from "@renderer/controls/Dropdown";
import { Text } from "@renderer/controls/generic/Text";
import BankDropdown from "@renderer/controls/new/BankDropdown";
import NextBankDropdown from "@renderer/controls/new/NextBankDropdown";
import { incProjectFileVersionAction /*, setWorkspaceSettingsAction */ } from "@common/state/actions";
import { MEMORY_EDITOR } from "@common/state/common-ids";
import { useMainApi } from "@renderer/core/MainApi";
import { SetMemoryDialog } from "@renderer/appIde/dialogs/SetMemoryDialog";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";

type BankedMemoryPanelViewState = {
  topIndex?: number;
  isFullView?: boolean;
  currentSegment?: number;
  decimalView?: boolean;
  twoColumns?: boolean;
  charDump?: boolean;
  bankLabel?: boolean;
};

export type CachedRefreshState = {
  isFullView: boolean;
  currentSegment: number;
  decimalView: boolean;
};

const BankedMemoryPanel = ({ document: _document }: DocumentProps) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const { ideCommandsService } = useAppServices();

  // --- Get the machine information
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const machineId = useSelector((s) => s.emulatorState.machineId);
  const [banksView, setBanksView] = useState<boolean>(false);
  const [displayBankMatrix, setDisplayBankMatrix] = useState<boolean>(false);
  const [segmentOptions, setSegmentOptions] = useState<DropdownOption[]>([]);
  const allowRefresh = useRef(true);

  // --- View state variables
  const emuViewVersion = useSelector((s) => s.emulatorState?.emuViewVersion);
  const workspace = useSelector((s) => s.workspaceSettings?.[MEMORY_EDITOR]);
  
  // --- Load viewState ONCE during mount using useMemo with empty deps
  const loadedViewState = useMemo(() => {
    console.log("🔄 [MemoryPanel] Loading viewState during state initialization");
    const activeDoc = documentHubService.getActiveDocument();
    console.log("📄 [MemoryPanel] Active document:", activeDoc?.id);
    const viewState = activeDoc 
      ? documentHubService.getDocumentViewState(activeDoc.id) as BankedMemoryPanelViewState
      : undefined;
    console.log("💾 [MemoryPanel] Loaded viewState:", viewState);
    return viewState;
  }, []); // Empty deps = runs once on mount

  const [topIndex, setTopIndex] = useState<number>(() => loadedViewState?.topIndex ?? 0);
  const [isFullView, setIsFullView] = useState(() => loadedViewState?.isFullView ?? true);
  const [currentSegment, setCurrentSegment] = useState<number>(() => loadedViewState?.currentSegment ?? null);
  const [bankLabel, setBankLabel] = useState(() => loadedViewState?.bankLabel ?? true);
  const [decimalView, setDecimalView] = useState(() => loadedViewState?.decimalView ?? workspace?.decimalView ?? false);
  const [twoColumns, setTwoColumns] = useState(() => loadedViewState?.twoColumns ?? workspace?.twoColumns ?? true);
  const [charDump, setCharDump] = useState(() => loadedViewState?.charDump ?? workspace?.charDump ?? true);
  const [isReady, setIsReady] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  console.log("📊 [MemoryPanel] Initialized state:", {
    topIndex,
    isFullView,
    currentSegment,
    bankLabel,
    decimalView,
    twoColumns,
    charDump,
    isReady,
    hasScrolled
  });

  // --- State of the memory view
  const refreshInProgress = useRef(false);
  const memory = useRef<Uint8Array>(new Uint8Array(0x1_0000));
  
  // Initialize both memoryItems state and cachedItems ref together
  const initialMemoryItems = useMemo(() => {
    const memItems: number[] = [];
    const hasTwoColumns = loadedViewState?.twoColumns ?? workspace?.twoColumns ?? true;
    for (let addr = 0; addr < 0x1_0000; addr += hasTwoColumns ? 0x10 : 0x08) {
      memItems.push(addr);
    }
    console.log("📦 [MemoryPanel] Created", memItems.length, "memory items during initialization");
    return memItems;
  }, []); // Empty deps = compute once
  
  const [memoryItems, setMemoryItems] = useState<number[]>(initialMemoryItems);
  const cachedItems = useRef<number[]>(initialMemoryItems);
  const vlApi = useRef<VListHandle>(null);
  const [mem64kLabels, setMem64kLabels] = useState<string[]>([]);
  const [partitionLabels, setPartitionLabels] = useState<Record<number, string>>({});
  const pointedRegs = useRef<Record<number, string>>({});
  const [scrollVersion, setScrollVersion] = useState(1);
  const [lastJumpAddress, setLastJumpAddress] = useState<number>(-1);
  const [romFlags, setRomFlags] = useState<boolean[]>([]);

  // --- We need to use a reference to autorefresh, as we pass this info to another trhead
  const cachedRefreshState = useRef<CachedRefreshState>({
    isFullView,
    decimalView,
    currentSegment
  });

  // --- Track if this is the initial mount to skip saving viewState on first render
  const isInitialMount = useRef(true);
  const componentInstanceId = useRef(Math.random());

  const [isMemoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [addressToEdit, setAddressToEdit] = useState<number>(null);

  // --- Track mount/unmount and initialization phase
  const isInitializing = useRef(true);
  const machineSetupComplete = useRef(false);
  const hasScrolledToInitialPosition = useRef(false);
  
  useEffect(() => {
    console.log(`🟢 [MemoryPanel#${componentInstanceId.current}] Component MOUNTED`);
    // Reset scroll tracking on mount
    hasScrolledToInitialPosition.current = false;
    setHasScrolled(false);
    return () => {
      console.log(`🔴 [MemoryPanel#${componentInstanceId.current}] Component UNMOUNTED`);
      // Clean up debounced save on unmount
      if (saveViewStateTimeout.current) {
        clearTimeout(saveViewStateTimeout.current);
      }
    };
  }, []);

  // --- Respond to machineId changes
  useEffect(() => {
    isInitializing.current = true; // Mark as initializing when machine changes
    machineSetupComplete.current = false; // Reset machine setup flag
    const machine = machineRegistry.find((mi) => mi.machineId === machineId);
    const romPagesValue = machine?.features?.[MF_ROM] ?? 0;
    const ramBankValue = machine?.features?.[MF_BANK] ?? 0;
    
    (async () => {
      // Get ALL async data FIRST before any state updates
      const romFlags = await emuApi.getRomFlags();
      const labels = await emuApi.getPartitionLabels();
      
      // Now update all state synchronously in one batch
      const newBanksView = romPagesValue > 0 || ramBankValue > 0;
      console.log("🔧 [MemoryPanel] Setting banksView:", newBanksView);
      setBanksView(prev => {
        if (prev === newBanksView) {
          console.log("⏭️ [MemoryPanel] Skipping banksView update, value unchanged");
          return prev;
        }
        console.log("✏️ [MemoryPanel] banksView changed from", prev, "to", newBanksView);
        return newBanksView;
      });
      
      const newDisplayBankMatrix = ramBankValue > 8 || romPagesValue > 8;
      console.log("🔧 [MemoryPanel] Setting displayBankMatrix:", newDisplayBankMatrix);
      setDisplayBankMatrix(prev => {
        if (prev === newDisplayBankMatrix) {
          console.log("⏭️ [MemoryPanel] Skipping displayBankMatrix update, value unchanged");
          return prev;
        }
        console.log("✏️ [MemoryPanel] displayBankMatrix changed from", prev, "to", newDisplayBankMatrix);
        return newDisplayBankMatrix;
      });
      
      console.log("🔧 [MemoryPanel] Setting romFlags:", romFlags);
      setRomFlags(prev => {
        const flagsChanged = JSON.stringify(prev) !== JSON.stringify(romFlags);
        if (flagsChanged) {
          console.log("✏️ [MemoryPanel] romFlags changed, updating");
          return romFlags;
        } else {
          console.log("⏭️ [MemoryPanel] Skipping romFlags update, value unchanged");
          return prev;
        }
      });
      
      console.log("🔧 [MemoryPanel] Setting partitionLabels:", labels);
      setPartitionLabels(prev => {
        const labelsChanged = JSON.stringify(prev) !== JSON.stringify(labels);
        if (labelsChanged) {
          console.log("✏️ [MemoryPanel] partitionLabels changed, updating");
          return labels;
        } else {
          console.log("⏭️ [MemoryPanel] Skipping partitionLabels update, value unchanged");
          return prev;
        }
      });
      
      const options: DropdownOption[] = [];
      if (ramBankValue <= 8) {
        const ordered = Object.keys(labels)
          .map((l) => parseInt(l, 10))
          .sort((a, b) => (a < 0 && b < 0 ? b - a : a - b));
        ordered.forEach((key) => {
          if (key < 0) {
            options.push({ value: key.toString(), label: `ROM ${-key - 1}` });
          } else {
            options.push({ value: key.toString(), label: `BANK ${key}` });
          }
        });
        console.log("🔧 [MemoryPanel] Setting segmentOptions:", options);
        setSegmentOptions(prev => {
          const optionsChanged = JSON.stringify(prev) !== JSON.stringify(options);
          if (optionsChanged) {
            console.log("✏️ [MemoryPanel] segmentOptions changed, updating");
            return options;
          } else {
            console.log("⏭️ [MemoryPanel] Skipping segmentOptions update, value unchanged");
            return prev;
          }
        });
      }
      
      const newSegment = romPagesValue ? -1 : 0;
      console.log("🔧 [MemoryPanel] Setting currentSegment:", newSegment);
      setCurrentSegment(prev => {
        if (prev === newSegment) {
          console.log("⏭️ [MemoryPanel] Skipping currentSegment update, value unchanged");
          return prev;
        }
        console.log("✏️ [MemoryPanel] currentSegment changed from", prev, "to", newSegment);
        return newSegment;
      });
      
      // Mark initialization complete after ALL state updates
      isInitializing.current = false;
      machineSetupComplete.current = true;
      console.log("✅ [MemoryPanel] Machine setup complete, all state synchronized");
    })();
  }, [machineId]);

  // Debounce ref for saving to prevent immediate re-renders from hubVersion changes
  const saveViewStateTimeout = useRef<NodeJS.Timeout | null>(null);

  // --- Save the current view state (debounced to prevent triggering parent re-renders)
  const saveViewState = () => {
    const mergedState: BankedMemoryPanelViewState = {
      topIndex,
      isFullView,
      currentSegment,
      decimalView,
      twoColumns,
      charDump,
      bankLabel
    };
    
    // Debounce ENTIRE save operation - this prevents hubVersion from incrementing immediately
    if (saveViewStateTimeout.current) {
      clearTimeout(saveViewStateTimeout.current);
    }
    saveViewStateTimeout.current = setTimeout(async () => {
      console.log("💾 [MemoryPanel] Debounced save executing:", mergedState);
      documentHubService.saveActiveDocumentState(mergedState);
      await mainApi.saveProject();
      dispatch(incProjectFileVersionAction());
    }, 100); // Short 100ms debounce - just enough to batch rapid changes
  };

  // --- Creates the addresses to represent dump sections
  const createDumpSections = (length: number, hasTwoColums: boolean) => {
    const memItems: number[] = [];
    for (let addr = 0; addr < length; addr += hasTwoColums ? 0x10 : 0x08) {
      memItems.push(addr);
    }
    
    // Only update state if the array actually changed (different length or params)
    if (cachedItems.current.length !== memItems.length) {
      console.log("📦 [MemoryPanel] Updating memoryItems, length changed:", cachedItems.current.length, "→", memItems.length);
      cachedItems.current = memItems;
      setMemoryItems(memItems);
    } else {
      console.log("📦 [MemoryPanel] Skipping memoryItems update, no change needed");
    }
  };

  // --- This function refreshes the memory
  const refreshMemoryView = async () => {
    if (refreshInProgress.current) return;
    if (!allowRefresh.current) return;
    refreshInProgress.current = true;
    try {
      // --- Obtain the memory contents
      let partition: number | undefined;

      // --- Use partitions when multiple ROMs or Banks available
      if (!cachedRefreshState.current.isFullView) {
        partition = cachedRefreshState.current.currentSegment;
        if (isNaN(partition)) {
          partition = -1;
        }
      }

      // --- Get memory information
      const response = await emuApi.getMemoryContents(partition);
      memory.current = response.memory;
      
      // Only update partition labels if they actually changed
      setMem64kLabels(prevLabels => {
        if (JSON.stringify(prevLabels) === JSON.stringify(response.partitionLabels)) {
          console.log("🏷️ [MemoryPanel] Skipping mem64kLabels update, no change");
          return prevLabels; // Return same reference to prevent re-render
        }
        console.log("🏷️ [MemoryPanel] Updating mem64kLabels");
        return response.partitionLabels;
      });

      // --- Calculate tooltips for pointed addresses
      pointedRegs.current = {};
      if (
        machineState === MachineControllerState.Paused ||
        machineState === MachineControllerState.Stopped
      ) {
        extendPointedAddress("BC", response.bc);
        extendPointedAddress("DE", response.de);
        extendPointedAddress("HL", response.hl);
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
    } finally {
      refreshInProgress.current = false;
      // Don't increment scrollVersion here - it causes unnecessary re-renders
      // The scroll effect will handle scrolling when topIndex changes
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
    // Skip saving during initialization phase - only save after user interactions
    if (isInitialMount.current) {
      console.log("⏭️ [MemoryPanel] Skipping saveViewState on initial mount");
      isInitialMount.current = false;
      return;
    }
    if (isInitializing.current) {
      console.log("⏭️ [MemoryPanel] Skipping saveViewState during initialization");
      return;
    }
    saveViewState();
    cachedRefreshState.current = {
      isFullView,
      decimalView,
      currentSegment
    };
  }, [topIndex, isFullView, decimalView, currentSegment, twoColumns, charDump, bankLabel]);

  // --- Initial view: wait for machine setup, refresh memory, then mark as ready
  useEffect(() => {
    // Only run once on mount - manual initialization to ensure proper sequencing
    if (!isInitializing.current) return;
    
    (async () => {
      console.log("🔄 [MemoryPanel] Initial refresh of memory view");
      
      // Wait for machine setup to complete before proceeding
      let attempts = 0;
      while (!machineSetupComplete.current && attempts < 100) {
        if (attempts % 10 === 0) {
          console.log("⏳ [MemoryPanel] Waiting for machine setup to complete...");
        }
        await new Promise(resolve => setTimeout(resolve, 10));
        attempts++;
      }
      
      if (!machineSetupComplete.current) {
        console.warn("⚠️ [MemoryPanel] Machine setup timeout, proceeding anyway");
      }
      
      await refreshMemoryView();
      // Mark component as ready - now VirtualizedList will render with correct topIndex
      console.log("🔧 [MemoryPanel] Setting isReady: true");
      setIsReady(true);
      console.log("✅ [MemoryPanel] Component ready, topIndex:", topIndex);
    })();
  }, []); // Empty deps = run once on mount

  // --- Scroll to the desired position whenever topIndex changes externally (e.g., jump to address)
  const lastScrolledIndex = useRef(-1);
  
  useEffect(() => {
    // Only handle programmatic scrolls (like "jump to address"), not user scrolls
    if (!vlApi.current || scrollVersion === 1) {
      // Skip initial scroll - VirtualizedList will start at correct position
      return;
    }
    
    const scrollIndex = Math.floor(topIndex);
    if (scrollIndex !== lastScrolledIndex.current) {
      console.log("📜 [MemoryPanel] Programmatic scroll to index:", scrollIndex);
      lastScrolledIndex.current = scrollIndex;
      vlApi.current.scrollToIndex(scrollIndex, {
        align: "start"
      });
    }
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

  useEffect(() => {
    // Skip refresh during initialization - manual initialization effect handles the first refresh
    if (isInitializing.current) {
      console.log("⏭️ [MemoryPanel] Skipping refresh during initialization");
      return;
    }
    refreshMemoryView();
  }, [currentSegment, isFullView, decimalView, emuViewVersion]);

  // --- Change the length of the current dump section according to the view mode
  useEffect(
    () => createDumpSections(isFullView ? 0x1_0000 : 0x4000, twoColumns),
    [isFullView, twoColumns]
  );

  // --- Take care of refreshing the screen
  // useEmuStateListener(emuApi, refreshMemoryView);

  const OptionsBar = () => {
    return (
      <>
        <LabeledSwitch
          value={decimalView}
          label="Decimal"
          title="Use decimal numbers?"
          clicked={(v) => setDecimalView(v)}
        />
        <LabeledSwitch
          value={twoColumns}
          label="2 Columns"
          title="Use two-column layout?"
          clicked={(v) => {
            console.log("🔧 [MemoryPanel] Setting twoColumns:", v);
            setTwoColumns(v);
            createDumpSections(memory.current.length, v);
            if (v) {
              console.log("🔧 [MemoryPanel] Setting topIndex (2col):", Math.floor(topIndex / 2));
              setTopIndex(Math.floor(topIndex / 2));
            } else {
              console.log("🔧 [MemoryPanel] Setting topIndex (1col):", topIndex * 2);
              setTopIndex(topIndex * 2);
            }
            console.log("🔧 [MemoryPanel] Setting scrollVersion:", scrollVersion + 1);
            setScrollVersion(scrollVersion + 1);
          }}
        />
        <LabeledSwitch
          value={charDump}
          label="Chars"
          title="Show characters dump?"
          clicked={setCharDump}
        />
        {banksView && (
          <LabeledSwitch
            value={bankLabel}
            label="Bank"
            title="Display bank label information?"
            clicked={setBankLabel}
          />
        )}
        <AddressInput
          label="Go To"
          clearOnEnter={true}
          decimalView={decimalView}
          onGotFocus={() => {
            allowRefresh.current = false;
          }}
          onAddressSent={async (address) => {
            const newTopIndex = Math.floor(address / (twoColumns ? 16 : 8));
            console.log("🎯 [MemoryPanel] Jump to address:", {
              address: `0x${address.toString(16).toUpperCase()}`,
              twoColumns,
              calculatedTopIndex: newTopIndex
            });
            setLastJumpAddress(address);
            setTopIndex(newTopIndex);
            setScrollVersion(scrollVersion + 1);
            allowRefresh.current = true;
          }}
        />
      </>
    );
  };

  const editMemoryContent = (address: number) => {
    setMemoryDialogOpen(true);
    setAddressToEdit(address);
  };

  // --- Rename dialog box to display
  const setMemoryDialog = isMemoryDialogOpen && (
    <SetMemoryDialog
      address={addressToEdit}
      currentValue={memory.current[addressToEdit]}
      decimal={decimalView}
      onSetMemory={async (newValue: string, sizeOption: string, bigEndian: boolean) => {
        const command = `setmem ${addressToEdit} ${newValue.replace(" ", "")} ${sizeOption} ${bigEndian ? "-be" : ""}`;
        await ideCommandsService.executeCommand(command);
      }}
      onClose={() => {
        setMemoryDialogOpen(false);
      }}
    />
  );

  console.log("🎨 [MemoryPanel] Rendering component with state:", {
    topIndex,
    isFullView,
    currentSegment,
    twoColumns,
    charDump,
    memoryItemsLength: memoryItems.length,
    isReady,
    hasScrolled
  });

  // Don't render at all until isReady
  if (!isReady) {
    console.log("⏸️ [MemoryPanel] Waiting for ready:", { isReady });
    return null;
  }

  // For non-zero topIndex, hide the component until scroll completes to prevent flicker
  const shouldHideUntilScrolled = topIndex > 0 && !hasScrolled;

  if (shouldHideUntilScrolled) {
    console.log("👻 [MemoryPanel] Rendering hidden (waiting for scroll):", { topIndex, hasScrolled });
  }

  return (
    <FullPanel fontFamily="--monospace-font" fontSize="0.8em" style={{ opacity: shouldHideUntilScrolled ? 0 : 1 }}>
      {setMemoryDialog}
      <PanelHeader>
        <OptionsBar />
      </PanelHeader>
      {banksView && (
        <PanelHeader>
          <LabeledSwitch
            value={isFullView}
            label="64K View"
            title="Show the full 64K memory"
            clicked={(v) => setIsFullView(v)}
          />
          {!isFullView && (
            <>
              <LabelSeparator width={4} />
              <Text text="Selected bank" />
              <LabelSeparator width={4} />
              {!displayBankMatrix && (
                <Dropdown
                  options={segmentOptions}
                  initialValue={currentSegment?.toString()}
                  width={80}
                  onChanged={async (opt) => {
                    setCurrentSegment(parseInt(opt));
                    setTopIndex(0);
                    setLastJumpAddress(0);
                    // --- Delay 3s
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    setLastJumpAddress(-1);
                  }}
                />
              )}
              {displayBankMatrix && machineId === MI_Z88 && (
                <BankDropdown
                  initialValue={currentSegment ?? 0}
                  width={48}
                  decimalView={decimalView}
                  onChanged={async (opt) => {
                    setCurrentSegment(opt);
                    setTopIndex(0);
                    setLastJumpAddress(0);
                    // --- Delay 3s
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    setLastJumpAddress(-1);
                  }}
                />
              )}
              {displayBankMatrix && machineId === MI_ZXNEXT && (
                <NextBankDropdown
                  banks={224}
                  initialValue={currentSegment ?? 0}
                  width={80}
                  decimalView={decimalView}
                  onChanged={async (opt) => {
                    setCurrentSegment(opt);
                    setTopIndex(0);
                    setLastJumpAddress(0);
                    // --- Delay 3s
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    setLastJumpAddress(-1);
                  }}
                />
              )}
            </>
          )}
        </PanelHeader>
      )}
      <FullPanel>
        <VirtualizedList
          items={memoryItems}
          overscan={25}
          startIndex={topIndex}
          onScroll={() => {
            // User scroll tracking disabled - we only track programmatic scrolls
            // This simplifies the state machine and prevents feedback loops
            /*
            if (!vlApi.current || cachedItems.current.length === 0) return;
            const newTopIndex = vlApi.current.findStartIndex();
            if (newTopIndex !== topIndex) {
              console.log("📜 [MemoryPanel] User scrolled, updating topIndex:", newTopIndex);
              setTopIndex(newTopIndex);
            }
            */
          }}
          apiLoaded={(api) => {
            console.log("🔌 [MemoryPanel] VirtualizedList API loaded");
            vlApi.current = api;
            // Reset lastScrolledIndex when API reloads to force scroll on next effect
            lastScrolledIndex.current = -1;
            
            // Mark as scrolled after a short delay to ensure scroll completes
            if (!hasScrolledToInitialPosition.current && topIndex > 0) {
              console.log("⏳ [MemoryPanel] Waiting for initial scroll to complete...");
              setTimeout(() => {
                console.log("✅ [MemoryPanel] Initial scroll complete");
                hasScrolledToInitialPosition.current = true;
                setHasScrolled(true);
              }, 50); // Small delay to ensure scroll completes
            } else {
              // If starting at topIndex 0, no scroll needed
              hasScrolledToInitialPosition.current = true;
              setHasScrolled(true);
            }
          }}
          renderItem={(idx) => {
            const partitionLabel = isFullView
              ? mem64kLabels[memoryItems[idx] >> 13]
              : partitionLabels?.[currentSegment];

            const section1Address = memoryItems[idx];
            const section2Address = memoryItems[idx] + 0x08;
            const section1IsRom = romFlags[(section1Address >> 13) & 0x07];
            const section2IsRom = romFlags[(section2Address >> 13) & 0x07];

            return (
              <HStack
                backgroundColor={idx % 2 === 0 ? "--bgcolor-disass-even-row" : "transparent"}
                hoverBackgroundColor="--bgcolor-disass-hover"
              >
                <DumpSection
                  showPartitions={bankLabel}
                  partitionLabel={partitionLabel}
                  address={section1Address}
                  memory={memory.current}
                  charDump={charDump}
                  pointedInfo={pointedRegs.current}
                  decimalView={decimalView}
                  lastJumpAddress={lastJumpAddress}
                  isRom={section1IsRom}
                  editClicked={editMemoryContent}
                />
                {twoColumns && (
                  <DumpSection
                    showPartitions={bankLabel}
                    partitionLabel={partitionLabel}
                    address={section2Address}
                    memory={memory.current}
                    pointedInfo={pointedRegs.current}
                    charDump={charDump}
                    decimalView={decimalView}
                    lastJumpAddress={lastJumpAddress}
                    isRom={section2IsRom}
                    editClicked={editMemoryContent}
                  />
                )}
              </HStack>
            );
          }}
        />
      </FullPanel>
    </FullPanel>
  );
};

// Custom comparator to prevent re-renders when props haven't meaningfully changed
const arePropsEqual = (prevProps: DocumentProps, nextProps: DocumentProps) => {
  // Only re-render if the document ID changes
  const docIdChanged = prevProps.document?.id !== nextProps.document?.id;
  if (docIdChanged) {
    console.log("🔄 [MemoryPanel] Document ID changed, allowing re-render");
    return false; // Props are NOT equal, allow re-render
  }
  console.log("⏭️ [MemoryPanel] Props unchanged, preventing re-render");
  return true; // Props are equal, prevent re-render
};

// Wrap in memo with custom comparator to prevent unnecessary re-renders from parent updates
export const createMemoryPanel = memo(BankedMemoryPanel, arePropsEqual);
