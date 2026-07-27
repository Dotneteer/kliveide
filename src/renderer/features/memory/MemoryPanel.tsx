import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import { FullPanel, HStack } from "@renderer/controls/layout/Panels";
import { PanelHeader } from "@renderer/appIde/DocumentPanels/helpers/PanelHeader";
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
  convertTopIndexForViewMode,
  createRowAddresses,
  getByteCount,
  getBytesPerRow,
  resolveViewMode,
  usesTwoColumns
} from "./memoryViewModel";
import { useLoadedMemoryViewState, useMemoryViewStatePersistence } from "./useMemoryViewState";
import { useMemoryMachineSetup } from "./useMemoryMachineSetup";
import { useMemoryRefresh } from "./useMemoryRefresh";
import { MemoryToolbar } from "./MemoryToolbar";
import { MemoryBankToolbar } from "./MemoryBankToolbar";
import { MemoryDumpSection } from "./MemoryDumpSection";
import { createVisibleMemoryRenderRecorder } from "./memoryPerformance";

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
  const vlApi = useRef<VListHandle>(null);
  const [scrollVersion, setScrollVersion] = useState(1);
  const [lastJumpAddress, setLastJumpAddress] = useState<number>(-1);
  const renderMetrics = useMemo(() => createVisibleMemoryRenderRecorder(), []);

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
  const memoryRefresh = useMemoryRefresh({
    allowRefresh,
    cachedRefreshState,
    emuApi,
    machineState
  });
  const memoryItems = useMemo(
    () => createRowAddresses(memoryRefresh.memoryLength, bytesPerRow),
    [memoryRefresh.memoryLength, bytesPerRow]
  );

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
      await memoryRefresh.refreshMemoryView();
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
          await memoryRefresh.refreshMemoryView();
      }
    })();
  }, [machineState, memoryRefresh.refreshMemoryView]);

  useEffect(() => {
    // Skip refresh during initialization - manual initialization effect handles the first refresh
    if (machineSetup.isInitializing) {
      return;
    }
    memoryRefresh.refreshMemoryView();
  }, [
    currentSegment,
    isFullView,
    decimalView,
    emuViewVersion,
    machineSetup.isInitializing,
    memoryRefresh.refreshMemoryView
  ]);

  // --- Take care of refreshing the screen
  const handleEmuStateChange = useCallback(() => {
    // Don't refresh if AddressInput has focus
    if (!allowRefresh.current) {
      return Promise.resolve();
    }
    setScrollVersion((prev) => prev + 1);
    return memoryRefresh.refreshMemoryView();
  }, [memoryRefresh.refreshMemoryView]);

  useEmuStateListener(emuApi, handleEmuStateChange);

  useEffect(() => {
    renderMetrics.flush(memoryRefresh.memoryVersion, viewMode);
  });

  const handleRefreshPauseChanged = useCallback((paused: boolean) => {
    allowRefresh.current = !paused;
  }, []);

  const handleViewModeChanged = useCallback((newMode: DumpViewMode) => {
    setTopIndex(convertTopIndexForViewMode(topIndex, viewMode, newMode));
    setViewMode(newMode);
    setScrollVersion((version) => version + 1);
  }, [topIndex, viewMode]);

  const handleGoToAddress = useCallback((address: number) => {
    const newTopIndex = Math.floor(address / bytesPerRow);
    setLastJumpAddress(address);
    setTopIndex(newTopIndex);
    setScrollVersion((version) => version + 1);
  }, [bytesPerRow]);

  const handleSegmentChanged = useCallback((segment: number) => {
    setCurrentSegment(segment);
    setTopIndex(0);
    setLastJumpAddress(0);
    setTimeout(() => {
      setLastJumpAddress(-1);
    }, 3000);
  }, []);

  const editMemoryContent = useCallback((address: number) => {
    const isRom = !!machineSetup.romFlags?.[(address >> 13) & 0x07];
    const currentValue = memoryRefresh.memory[address];

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
  }, [decimalView, dialogs, ideCommandsService, machineSetup.romFlags, memoryRefresh.memory]);

  // Don't render at all until isReady
  if (!isReady) {
    return null;
  }

  // For non-zero topIndex, hide the component until scroll completes to prevent flicker
  const shouldHideUntilScrolled = topIndex > 0 && !hasScrolled;

  return (
    <FullPanel
      fontFamily="--monospace-font"
      fontSize="0.8em"
      style={{ opacity: shouldHideUntilScrolled ? 0 : 1 }}
    >
      <PanelHeader>
        <MemoryToolbar
          bankLabel={bankLabel}
          banksView={machineSetup.banksView}
          charDump={charDump}
          decimalView={decimalView}
          viewMode={viewMode}
          onBankLabelChanged={setBankLabel}
          onCharDumpChanged={setCharDump}
          onDecimalViewChanged={setDecimalView}
          onGoToAddress={handleGoToAddress}
          onRefreshPauseChanged={handleRefreshPauseChanged}
          onViewModeChanged={handleViewModeChanged}
        />
      </PanelHeader>
      {machineSetup.banksView && (
        <PanelHeader>
          <MemoryBankToolbar
            currentSegment={currentSegment}
            decimalView={decimalView}
            isFullView={isFullView}
            machineId={machineId}
            machineSetup={machineSetup}
            onFullViewChanged={setIsFullView}
            onSegmentChanged={handleSegmentChanged}
          />
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
            if (!vlApi.current || memoryItems.length === 0) return;
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
            renderMetrics.recordRow(showTwoColumns ? 2 : 1);
            const partitionLabel = isFullView
              ? memoryRefresh.mem64kLabels[memoryItems[idx] >> 13]
              : machineSetup.partitionLabels?.[currentSegment];

            const section1Address = memoryItems[idx];
            const section2Address = memoryItems[idx] + 0x08;
            const section1IsRom = !!machineSetup.romFlags?.[(section1Address >> 13) & 0x07];
            const section2IsRom = !!machineSetup.romFlags?.[(section2Address >> 13) & 0x07];
            const section1Bytes = memoryRefresh.memory.slice(section1Address, section1Address + byteCount);
            const section2Bytes = memoryRefresh.memory.slice(section2Address, section2Address + byteCount);

            return (
              <HStack
                backgroundColor={idx % 2 === 0 ? "--bgcolor-disass-even-row" : "transparent"}
                hoverBackgroundColor="--bgcolor-disass-hover"
              >
                <MemoryDumpSection
                  showPartitions={bankLabel}
                  partitionLabel={partitionLabel}
                  address={section1Address}
                  bytes={section1Bytes}
                  charDump={charDump}
                  pointedInfo={memoryRefresh.pointedRegs}
                  decimalView={decimalView}
                  lastJumpAddress={lastJumpAddress}
                  isRom={section1IsRom}
                  editClicked={editMemoryContent}
                />
                {showTwoColumns && (
                  <MemoryDumpSection
                    showPartitions={bankLabel}
                    partitionLabel={partitionLabel}
                    address={section2Address}
                    bytes={section2Bytes}
                    pointedInfo={memoryRefresh.pointedRegs}
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
