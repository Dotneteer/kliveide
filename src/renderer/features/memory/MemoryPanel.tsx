import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { MI_Z88, MI_ZXNEXT } from "@common/machines/constants";
import { AddressInput } from "@renderer/controls/AddressInput";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { DumpSection } from "@renderer/appIde/DocumentPanels/DumpSection";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import { FullPanel, HStack } from "@renderer/controls/layout/Panels";
import { PanelHeader } from "@renderer/appIde/DocumentPanels/helpers/PanelHeader";
import Dropdown from "@renderer/controls/Dropdown";
import { Text } from "@renderer/controls/layout/Text";
import BankDropdown from "@renderer/controls/new/BankDropdown";
import {
  incProjectFileVersionAction /*, setWorkspaceSettingsAction */
} from "@common/state/actions";
import { MEMORY_EDITOR } from "@common/state/common-ids";
import { useMainApi } from "@renderer/core/MainApi";
import {
  SetMemoryDialog,
  SetMemoryDialogResult
} from "@renderer/appIde/dialogs/SetMemoryDialog";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import {
  CachedRefreshState,
  DumpViewMode,
  buildPointedRegisterHints,
  convertTopIndexForViewMode,
  createRowAddresses,
  getByteCount,
  getBytesPerRow,
  resolveMemoryPartition,
  resolveViewMode,
  usesTwoColumns,
  viewModeOptions
} from "./memoryViewModel";
import { useLoadedMemoryViewState, useMemoryViewStatePersistence } from "./useMemoryViewState";
import { useMemoryMachineSetup } from "./useMemoryMachineSetup";

const BankedMemoryPanel = ({ document }: DocumentProps) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const dialogs = useDialogs();
  const { ideCommandsService } = useAppServices();

  // --- Get the machine information
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const machineId = useSelector((s) => s.emulatorState.machineId);
  const machineSetup = useMemoryMachineSetup(machineId, emuApi);
  const allowRefresh = useRef(true);

  // --- View state variables
  const emuViewVersion = useSelector((s) => s.emulatorState?.emuViewVersion);
  const workspace = useSelector((s) => s.workspaceSettings?.[MEMORY_EDITOR]);

  const loadedViewState = useLoadedMemoryViewState(documentHubService, document);

  const [topIndex, setTopIndex] = useState<number>(() => loadedViewState?.topIndex ?? 0);
  const [isFullView, setIsFullView] = useState(() => loadedViewState?.isFullView ?? true);
  const [currentSegment, setCurrentSegment] = useState<number>(
    () => loadedViewState?.currentSegment ?? null
  );
  const [bankLabel, setBankLabel] = useState(() => loadedViewState?.bankLabel ?? true);
  const [decimalView, setDecimalView] = useState(
    () => loadedViewState?.decimalView ?? workspace?.decimalView ?? false
  );
  const [viewMode, setViewMode] = useState<DumpViewMode>(
    () => resolveViewMode(loadedViewState?.viewMode, loadedViewState?.twoColumns ?? workspace?.twoColumns ?? true)
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
    const initialViewMode = resolveViewMode(loadedViewState?.viewMode, loadedViewState?.twoColumns ?? workspace?.twoColumns ?? true);
    return createRowAddresses(0x1_0000, getBytesPerRow(initialViewMode));
  }, []); // Empty deps = compute once

  const [memoryItems, setMemoryItems] = useState<number[]>(initialMemoryItems);
  const cachedItems = useRef<number[]>(initialMemoryItems);
  const vlApi = useRef<VListHandle>(null);
  const [mem64kLabels, setMem64kLabels] = useState<string[]>([]);
  const pointedRegs = useRef<Record<number, string>>({});
  const [scrollVersion, setScrollVersion] = useState(1);
  const [lastJumpAddress, setLastJumpAddress] = useState<number>(-1);

  // Derived layout values from viewMode
  const bytesPerRow = getBytesPerRow(viewMode);
  const showTwoColumns = usesTwoColumns(viewMode);
  const byteCount = getByteCount(viewMode);

  // --- We need to use a reference to autorefresh, as we pass this info to another trhead
  const cachedRefreshState = useRef<CachedRefreshState>({
    isFullView,
    decimalView,
    currentSegment
  });

  const hasScrolledToInitialPosition = useRef(false);

  useEffect(() => {
    // Reset scroll tracking on mount
    hasScrolledToInitialPosition.current = false;
    setHasScrolled(false);
  }, []);

  useEffect(() => {
    if (machineSetup.isInitializing || machineSetup.setupVersion === 0) return;
    setCurrentSegment((prev) => {
      const next = prev ?? machineSetup.defaultSegment;
      cachedRefreshState.current = {
        ...cachedRefreshState.current,
        currentSegment: next
      };
      return next;
    });
  }, [machineSetup.defaultSegment, machineSetup.isInitializing, machineSetup.setupVersion]);

  // --- Creates the addresses to represent dump sections
  const createDumpSections = useCallback((length: number, rowBytes: number) => {
    const memItems = createRowAddresses(length, rowBytes);

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
      // --- Use partitions when multiple ROMs or Banks available
      const partition = resolveMemoryPartition(cachedRefreshState.current);

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
      pointedRegs.current = buildPointedRegisterHints(response, machineState);
      createDumpSections(memory.current.length, bytesPerRow);
    } finally {
      refreshInProgress.current = false;
      // Don't increment scrollVersion here - it causes unnecessary re-renders
      // The scroll effect will handle scrolling when topIndex changes
    }

  }, [emuApi, machineState, createDumpSections, bytesPerRow]);

  useMemoryViewStatePersistence({
    bankLabel,
    cachedRefreshState,
    charDump,
    currentSegment,
    decimalView,
    dispatch,
    documentHubService,
    incProjectFileVersion: incProjectFileVersionAction,
    isFullView,
    isInitializing: machineSetup.isInitializing,
    mainApi,
    topIndex,
    viewMode
  });

  // --- Initial view: wait for machine setup, refresh memory, then mark as ready
  useEffect(() => {
    if (machineSetup.isInitializing || machineSetup.setupVersion === 0) return;
    let cancelled = false;

    void (async () => {
      const nextSegment = currentSegment ?? machineSetup.defaultSegment;
      cachedRefreshState.current = {
        isFullView,
        decimalView,
        currentSegment: nextSegment
      };
      if (currentSegment === null) {
        setCurrentSegment(nextSegment);
      }
      await refreshMemoryView();
      if (!cancelled) {
        setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [machineSetup.setupVersion]); // Run once for each completed machine setup

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
    if (machineSetup.isInitializing) {
      return;
    }
    refreshMemoryView();
  }, [currentSegment, isFullView, decimalView, emuViewVersion, machineSetup.isInitializing]);

  // --- Change the length of the current dump section according to the view mode
  useEffect(
    () => createDumpSections(isFullView ? 0x1_0000 : 0x4000, bytesPerRow),
    [isFullView, viewMode]
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
        <LabelSeparator width={8} />
        <Text text="View" />
        <LabelSeparator />
        <Dropdown
          options={viewModeOptions}
          initialValue={viewMode}
          width={90}
          onOpenChange={(open) => { allowRefresh.current = !open; }}
          onChanged={(val) => {
            const newMode = val as DumpViewMode;
            const newBytesPerRow = getBytesPerRow(newMode);
            setTopIndex(convertTopIndexForViewMode(topIndex, viewMode, newMode));
            setViewMode(newMode);
            createDumpSections(memory.current.length, newBytesPerRow);
            setScrollVersion(scrollVersion + 1);
          }}
        />
        <LabelSeparator width={8} />
        <LabeledSwitch
          value={charDump}
          label="Chars"
          title="Show characters dump?"
          clicked={setCharDump}
        />
        {machineSetup.banksView && (
          <>
            <LabelSeparator width={8} />
            <LabeledSwitch
              value={bankLabel}
              label="Bank"
              title="Display bank label information?"
              clicked={setBankLabel}
            />
          </>
        )}
        <LabelSeparator width={8} />
        <AddressInput
          label="Go To"
          clearOnEnter={true}
          decimalView={decimalView}
          onGotFocus={() => {
            allowRefresh.current = false;
          }}
          onAddressSent={async (address) => {
            const newTopIndex = Math.floor(address / bytesPerRow);
            setLastJumpAddress(address);
            setTopIndex(newTopIndex);
            setScrollVersion(scrollVersion + 1);
            allowRefresh.current = true;
          }}
        />
      </>
    );
  };

  const editMemoryContent = useCallback((address: number) => {
    const isRom = !!machineSetup.romFlags?.[(address >> 13) & 0x07];
    const currentValue = memory.current[address];

    void (async () => {
      const result = await dialogs.open<SetMemoryDialogResult>((controls) => (
        <SetMemoryDialog
          address={address}
          currentValue={currentValue}
          decimal={decimalView}
          isRom={isRom}
          onSetMemory={(result) => controls.close(result)}
          onClose={() => controls.cancel()}
        />
      ));

      if (!result) return;

      const command = `setmem ${address} ${result.value.replace(" ", "")} ${result.sizeOption} ${
        result.bigEndian ? "-be" : ""
      }`;
      await ideCommandsService.executeCommand(command);
    })();
  }, [decimalView, dialogs, ideCommandsService, machineSetup.romFlags]);

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
      <PanelHeader>
        <OptionsBar />
      </PanelHeader>
      {machineSetup.banksView && (
        <PanelHeader>
          <LabeledSwitch
            value={isFullView}
            label="64K View"
            title="Show the full 64K memory"
            clicked={(v) => setIsFullView(v)}
          />
          {!isFullView && (
            <>
              <LabelSeparator />
              <Text text="Selected bank" />
              <LabelSeparator />
              {!machineSetup.displayBankMatrix && (
                <Dropdown
                  options={machineSetup.segmentOptions}
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
              {machineSetup.displayBankMatrix && machineId === MI_Z88 && (
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
              {machineSetup.displayBankMatrix && machineId === MI_ZXNEXT && (
                <BankDropdown
                  banks={224}
                  showNextItems
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
              : machineSetup.partitionLabels?.[currentSegment];

            const section1Address = memoryItems[idx];
            const section2Address = memoryItems[idx] + 0x08;
            const section1IsRom = !!machineSetup.romFlags?.[(section1Address >> 13) & 0x07];
            const section2IsRom = !!machineSetup.romFlags?.[(section2Address >> 13) & 0x07];

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
                  byteCount={byteCount}
                />
                {showTwoColumns && (
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
                    byteCount={byteCount}
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
