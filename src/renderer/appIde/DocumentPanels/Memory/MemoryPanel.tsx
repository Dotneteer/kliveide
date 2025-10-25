import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  incProjectFileVersionAction /*, setWorkspaceSettingsAction */
} from "@common/state/actions";
import { MEMORY_EDITOR } from "@common/state/common-ids";
import { useMainApi } from "@renderer/core/MainApi";
import { SetMemoryDialog } from "@renderer/appIde/dialogs/SetMemoryDialog";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";

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
    const activeDoc = documentHubService.getActiveDocument();
    const viewState = activeDoc
      ? (documentHubService.getDocumentViewState(activeDoc.id) as BankedMemoryPanelViewState)
      : undefined;
    return viewState;
  }, []); // Empty deps = runs once on mount

  const [topIndex, setTopIndex] = useState<number>(() => loadedViewState?.topIndex ?? 0);
  const [isFullView, setIsFullView] = useState(() => loadedViewState?.isFullView ?? true);
  const [currentSegment, setCurrentSegment] = useState<number>(
    () => loadedViewState?.currentSegment ?? null
  );
  const [bankLabel, setBankLabel] = useState(() => loadedViewState?.bankLabel ?? true);
  const [decimalView, setDecimalView] = useState(
    () => loadedViewState?.decimalView ?? workspace?.decimalView ?? false
  );
  const [twoColumns, setTwoColumns] = useState(
    () => loadedViewState?.twoColumns ?? workspace?.twoColumns ?? true
  );
  const [charDump, setCharDump] = useState(
    () => loadedViewState?.charDump ?? workspace?.charDump ?? true
  );
  const [isReady, setIsReady] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

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

  const [isMemoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [addressToEdit, setAddressToEdit] = useState<number>(null);

  // --- Track mount/unmount and initialization phase
  const isInitializing = useRef(true);
  const machineSetupComplete = useRef(false);
  const hasScrolledToInitialPosition = useRef(false);

  useEffect(() => {
    // Reset scroll tracking on mount
    hasScrolledToInitialPosition.current = false;
    setHasScrolled(false);
    return () => {
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
      setBanksView((prev) => {
        if (prev === newBanksView) {
          return prev;
        }
        return newBanksView;
      });

      const newDisplayBankMatrix = ramBankValue > 8 || romPagesValue > 8;
      setDisplayBankMatrix((prev) => {
        if (prev === newDisplayBankMatrix) {
          return prev;
        }
        return newDisplayBankMatrix;
      });

      setRomFlags((prev) => {
        const flagsChanged = JSON.stringify(prev) !== JSON.stringify(romFlags);
        if (flagsChanged) {
          return romFlags;
        } else {
          return prev;
        }
      });

      setPartitionLabels((prev) => {
        const labelsChanged = JSON.stringify(prev) !== JSON.stringify(labels);
        if (labelsChanged) {
          return labels;
        } else {
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
        setSegmentOptions((prev) => {
          const optionsChanged = JSON.stringify(prev) !== JSON.stringify(options);
          if (optionsChanged) {
            return options;
          } else {
            return prev;
          }
        });
      }

      const newSegment = romPagesValue ? -1 : 0;
      setCurrentSegment((prev) => {
        if (prev === newSegment) {
          return prev;
        }
        return newSegment;
      });

      // Mark initialization complete after ALL state updates
      isInitializing.current = false;
      machineSetupComplete.current = true;
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
      documentHubService.saveActiveDocumentState(mergedState);
      await mainApi.saveProject();
      dispatch(incProjectFileVersionAction());
    }, 100); // Short 100ms debounce - just enough to batch rapid changes
  };

  // --- Creates the addresses to represent dump sections
  const createDumpSections = useCallback((length: number, hasTwoColums: boolean) => {
    const memItems: number[] = [];
    for (let addr = 0; addr < length; addr += hasTwoColums ? 0x10 : 0x08) {
      memItems.push(addr);
    }

    // Only update state if the array actually changed (different length or params)
    if (cachedItems.current.length !== memItems.length) {
      cachedItems.current = memItems;
      setMemoryItems(memItems);
    } else {
    }
  }, []);

  // --- This function refreshes the memory
  const refreshMemoryView = useCallback(async () => {
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
      setMem64kLabels((prevLabels) => {
        if (JSON.stringify(prevLabels) === JSON.stringify(response.partitionLabels)) {
          return prevLabels; // Return same reference to prevent re-render
        }
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
  }, [emuApi, machineState, createDumpSections, twoColumns]);

  // --- Save viewState changed
  useEffect(() => {
    // Skip saving during initialization phase - only save after user interactions
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (isInitializing.current) {
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
      // Wait for machine setup to complete before proceeding
      let attempts = 0;
      while (!machineSetupComplete.current && attempts < 100) {
        if (attempts % 10 === 0) {
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        attempts++;
      }

      await refreshMemoryView();
      // Mark component as ready - now VirtualizedList will render with correct topIndex
      setIsReady(true);
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
  const handleEmuStateChange = useCallback(() => {
    // Don't refresh if AddressInput has focus
    if (!allowRefresh.current) {
      return Promise.resolve();
    }
    setScrollVersion((prev) => prev + 1);
    return refreshMemoryView();
  }, [refreshMemoryView]);

  useEmuStateListener(emuApi, handleEmuStateChange);

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

  // Don't render at all until isReady
  if (!isReady) {
    return null;
  }

  // For non-zero topIndex, hide the component until scroll completes to prevent flicker
  const shouldHideUntilScrolled = topIndex > 0 && !hasScrolled;

  if (shouldHideUntilScrolled) {
  }

  return (
    <FullPanel
      fontFamily="--monospace-font"
      fontSize="0.8em"
      style={{ opacity: shouldHideUntilScrolled ? 0 : 1 }}
    >
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
            if (!vlApi.current || cachedItems.current.length === 0) return;
            const newTopIndex = vlApi.current.findStartIndex();
            if (newTopIndex !== topIndex) {
              setTopIndex(newTopIndex);
            }
          }}
          apiLoaded={(api) => {
            vlApi.current = api;
            // Reset lastScrolledIndex when API reloads to force scroll on next effect
            lastScrolledIndex.current = -1;

            // Mark as scrolled after a short delay to ensure scroll completes
            if (!hasScrolledToInitialPosition.current && topIndex > 0) {
              setTimeout(() => {
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
            const section1IsRom = !!romFlags?.[(section1Address >> 13) & 0x07];
            const section2IsRom = !!romFlags?.[(section2Address >> 13) & 0x07];

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
    return false; // Props are NOT equal, allow re-render
  }
  return true; // Props are equal, prevent re-render
};

// Wrap in memo with custom comparator to prevent unnecessary re-renders from parent updates
export const createMemoryPanel = memo(BankedMemoryPanel, arePropsEqual);
