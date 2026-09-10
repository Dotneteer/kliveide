import styles from "./DisassemblyPanel.module.scss";
import { useRowSizes } from "@renderer/theming/useRowSizes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import {
  CT_CUSTOM_DISASSEMBLER,
  CT_DISASSEMBLER
} from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import {
  incProjectFileVersionAction,
  setIdeStatusMessageAction
} from "@common/state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import type { VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { useMainApi } from "@renderer/core/MainApi";
import {
  type CachedRefreshState,
  useDisassemblyViewStatePersistence,
  useLoadedDisassemblyViewState
} from "./disassemblyViewState";
import { useDisassemblyMachineSetup } from "./useDisassemblyMachineSetup";
import {
  type DisassemblerFactory,
  useDisassemblyRefresh
} from "./useDisassemblyRefresh";
import { DisassemblyRow } from "./DisassemblyRow";
import { derivePartitionWidthCh } from "@renderer/controls/data/partitionWidth";
import { useBreakpointDialog } from "../dialogs/useBreakpointDialog";
import {
  createDisassemblyOffsetOptions,
  DisassemblyBankToolbar,
  DisassemblyToolbar
} from "./DisassemblyToolbars";

/* M3: see `MemoryPanel` — the height belongs to `rowSizes`, not to this file. */
const BankedDisassemblyPanel = ({ document }: DocumentProps) => {
  // --- M3: the row height the virtualizer places by, matching `--row-size-disassembly` in the CSS.
  const { disassembly: disassemblyRowItemSize } = useRowSizes();
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  // --- One hook for the whole listing rather than one per row. Wrapped in `useCallback` because
  // --- `DisassemblyRow` is memoized: a fresh arrow on every render would re-render every row in
  // --- the listing on every tick.
  const openBreakpointDialog = useBreakpointDialog();
  const editBreakpoint = useCallback(
    (bp: BreakpointInfo) => void openBreakpointDialog(bp),
    [openBreakpointDialog]
  );

  // --- Get the machine information
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const machineId = useSelector((s) => s.emulatorState.machineId);

  const machineInfo = machineRegistry.find((mi) => mi.machineId === machineId);
  const machineSetup = useDisassemblyMachineSetup(machineId, emuApi);

  // --- Read the view state of the document
  const loadedViewState = useLoadedDisassemblyViewState(documentHubService, document);

  // --- View state variables
  const emuViewVersion = useSelector((s) => s.emulatorState?.emuViewVersion);
  const [topAddress, setTopAddress] = useState<number>(
    loadedViewState?.topAddress ?? 0
  );
  const [isFullView, setIsFullView] = useState(
    loadedViewState?.isFullView ?? true
  );
  const [autoRefresh, setAutoRefresh] = useState(
    loadedViewState?.autoRefresh ?? true
  );
  const [currentSegment, setCurrentSegment] = useState<number>(
    loadedViewState?.currentSegment ?? 0
  );
  const [bankLabel, setBankLabel] = useState(
    loadedViewState?.bankLabel ?? true
  );

  // --- Display options
  const [decimalView, setDecimalView] = useState(
    loadedViewState?.decimalView ?? false
  );
  const [ram, setRam] = useState(loadedViewState?.ram ?? true);
  const [screen, setScreen] = useState(loadedViewState?.screen ?? false);
  const [disassOffset, setDisassOffset] = useState(
    loadedViewState?.disassOffset ?? 0
  );

  const disassemblerFactory = machineInfo?.toolInfo?.[CT_DISASSEMBLER] as
    | DisassemblerFactory
    | undefined;
  const customDisassembly = machineInfo?.toolInfo?.[CT_CUSTOM_DISASSEMBLER];

  // --- Internal state values for disassembly
  const vlApi = useRef<VirtualizedListApi>(null);

  const [toScroll, setToScroll] = useState<number>(null);
  const [scrollVersion, setScrollVersion] = useState(0);
  const pendingScrollTopAddress = useRef(topAddress);

  const injectionVersion = useSelector((s) => s.compilation?.injectionVersion);
  const bpsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);

  // --- Refresh work reads these options asynchronously, so keep the latest values in a ref.
  const cachedRefreshState = useRef<CachedRefreshState>({
    isFullView,
    currentSegment,
    decimalView,
    autoRefresh,
    screen,
    ram
  });
  const setFollowPcTopAddress = useCallback((address: number) => {
    setTopAddress(address);
  }, []);
  const {
    breakpointMap,
    items,
    mem64kLabels,
    pausedPc,
    refreshDisassembly
  } = useDisassemblyRefresh({
    cachedRefreshState,
    customDisassembly,
    disassOffset,
    disassemblerFactory,
    emuApi,
    machineId,
    onFollowPcTopAddress: setFollowPcTopAddress
  });

  useDisassemblyViewStatePersistence({
    autoRefresh,
    bankLabel,
    cachedRefreshState,
    currentSegment,
    decimalView,
    disassOffset,
    documentId: document.id,
    dispatch,
    documentHubService,
    incProjectFileVersion: incProjectFileVersionAction,
    isFullView,
    mainApi,
    ram,
    screen,
    topAddress
  });

  useEffect(() => {
    if (
      !machineSetup.isInitializing &&
      machineSetup.setupVersion > 0 &&
      !machineSetup.allowViews
    ) {
      setIsFullView(true);
      setScrollVersion((version) => version + 1);
    }
  }, [machineSetup.allowViews, machineSetup.isInitializing, machineSetup.setupVersion]);

  useEffect(() => {
    pendingScrollTopAddress.current = topAddress;
  }, [topAddress]);

  // --- Initial view: refresh the disassembly list and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshDisassembly();
    setScrollVersion((version) => version + 1);
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (items.length > 0 && toScroll !== null) {
      const idx = items.findIndex((di) => di.address >= (toScroll ?? 0));
      if (idx >= 0) {
        vlApi.current?.scrollToIndex(idx, {
          align: "start"
        });
      }
      setToScroll(null);
    }
  }, [items, scrollVersion, toScroll]);

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async function () {
      switch (machineState) {
        case MachineControllerState.Paused:
        case MachineControllerState.Stopped:
          await refreshDisassembly();
          break;
      }
    })();
  }, [machineState]);

  // --- Refresh when the follow PC option changes
  useEffect(() => {
    refreshDisassembly();
  }, [
    autoRefresh,
    bpsVersion,
    injectionVersion,
    isFullView,
    decimalView,
    screen,
    ram,
    currentSegment,
    disassOffset,
    emuViewVersion
  ]);

  // --- Take care of refreshing the screen
  useEmuStateListener(emuApi, async () => {
    await refreshDisassembly();
  });

  /*
   * The width every row reserves for its hard comment, in characters.
   *
   * The comment is the only column with no fixed width, so before this each row sized to its own
   * text and the list came out ragged: a row carrying "; (Invoke ROM 3 subroutine)" ran ~80px past
   * its neighbours, and the zebra stripes ended at different x positions once the panel was narrow
   * enough to scroll. CSS cannot equalise siblings to the widest of them here - `virtua` positions
   * every row absolutely, so there is no shared sizing context and no table layout to fall back on.
   *
   * It does not need one: the panel is monospace, so a comment's width in `ch` *is* its length in
   * characters. Taking the maximum over the whole list rather than over the visible window keeps
   * the column from resizing as you scroll, and yields 0 - i.e. no column at all, exactly as
   * before - for the common case of a listing with no comments in it.
   */
  /*
   * The width every row reserves for its bank label. Uniform for the same reason as the comment
   * column above, and from the same symptom: a bank with no label used to drop the cell entirely
   * and a decimal view could mix 2ch and 3ch labels down one list.
   */
  const partitionWidthCh = useMemo(
    () =>
      derivePartitionWidthCh({
        // --- In a full view a row's label comes from its own 8K bank, so any of the eight can be
        // --- the widest; otherwise every row shows the one label of the current segment.
        candidateLabels: isFullView
          ? mem64kLabels
          : [machineSetup.partitionLabels?.[currentSegment]],
        decimalView,
        enabled: bankLabel && machineSetup.showBanks
      }),
    [
      bankLabel,
      currentSegment,
      decimalView,
      isFullView,
      mem64kLabels,
      machineSetup.partitionLabels,
      machineSetup.showBanks
    ]
  );

  const commentWidthCh = useMemo(
    () =>
      items.reduce(
        (widest, item) => (item.hardComment ? Math.max(widest, item.hardComment.length + 2) : widest),
        0
      ),
    [items]
  );

  return (
    /* --- M1: `0.8em` gave 12.8px here; see `MemoryPanel`. Follows the panel font size now. */
    <FullPanel fontFamily="--monospace-font" fontSize="--panel-font-size">
      <DisassemblyToolbar
        autoRefresh={autoRefresh}
        bankLabel={bankLabel}
        decimalView={decimalView}
        machineState={machineState}
        onAutoRefreshChanged={(value) => {
          setAutoRefresh(value);
          if (value) {
            setToScroll(0);
          }
          setScrollVersion((version) => version + 1);
          // Not `refreshDisassembly()` here: it reads `cachedRefreshState.current`, which only
          // picks up this new `autoRefresh` value once `useDisassemblyViewStatePersistence`'s own
          // effect re-runs and syncs it - one render after this handler, not during it. Calling it
          // here read the *previous* `autoRefresh`, so turning Follow PC on silently ran a manual,
          // full-range disassembly instead of the small ~1KB window around PC - the "few seconds"
          // this switch used to take. `autoRefresh` is now a dependency of the "refresh when the
          // follow PC option changes" effect below, which - because `useDisassemblyViewStatePersistence`
          // is called earlier in this component and so registers its effect first - always runs
          // after the sync effect, and so always sees the current value.
        }}
        onDecimalViewChanged={setDecimalView}
        onGoToAddress={(address) => {
          setToScroll(address);
          setScrollVersion((version) => version + 1);
        }}
        onGoToPc={() => {
          setToScroll(pausedPc);
          setScrollVersion((version) => version + 1);
        }}
        onManualRefresh={async () => {
          await refreshDisassembly();
          dispatch(setIdeStatusMessageAction("Disassembly refreshed", true));
        }}
        onRamChanged={setRam}
        onScreenChanged={setScreen}
        onShowBankLabelChanged={setBankLabel}
        pausedPc={pausedPc}
        ram={ram}
        screen={screen}
        topAddress={topAddress}
      />
      <DisassemblyBankToolbar
        allowViews={machineSetup.allowViews}
        autoRefresh={autoRefresh}
        currentSegment={currentSegment}
        decimalView={decimalView}
        disassOffset={disassOffset}
        displayBankMatrix={machineSetup.displayBankMatrix}
        isFullView={isFullView}
        offsetOptions={createDisassemblyOffsetOptions(decimalView)}
        onCurrentSegmentChanged={setCurrentSegment}
        onDisassOffsetChanged={setDisassOffset}
        onFullViewChanged={setIsFullView}
        segmentOptions={machineSetup.segmentOptions}
        partitionOptions={machineSetup.partitionOptions}
      />
      {items.length > 0 && (
        <div className={styles.disassemblyWrapper}>
          <VirtualizedList
            items={items}
            apiLoaded={(api) => (vlApi.current = api)}
            itemSize={disassemblyRowItemSize}
            revealUnmeasuredItems
            /* --- Long operands, labels and the bank/T-state columns overflow a narrow panel; see
               --- `MemoryPanel` for why the wrapper needs `max-content` for the bar to appear. */
            scrollRowsHorizontally
            onScroll={async () => {
              if (!vlApi.current) return;

              const startIndex = vlApi.current.findStartIndex();
              const item = items[startIndex];
              if (item) {
                pendingScrollTopAddress.current = item.address;
              }
            }}
            onScrollEnd={() => {
              const nextTopAddress = pendingScrollTopAddress.current;
              setTopAddress((currentTopAddress) =>
                nextTopAddress === currentTopAddress ? currentTopAddress : nextTopAddress
              );
            }}
            renderItem={(idx) => {
              const item = items[idx];
              if (!item) return <div></div>;

              return (
                <DisassemblyRow
                  bankLabel={bankLabel}
                  breakpoint={breakpointMap.get(item.address)}
                  commentWidthCh={commentWidthCh}
                  currentSegment={currentSegment}
                  decimalView={decimalView}
                  index={idx}
                  isFullView={isFullView}
                  item={item}
                  mem64kLabels={mem64kLabels}
                  onEditBreakpoint={editBreakpoint}
                  partitionLabels={machineSetup.partitionLabels}
                  partitionWidthCh={partitionWidthCh}
                  pausedPc={pausedPc}
                  rowHeight={disassemblyRowItemSize}
                  showBanks={machineSetup.showBanks}
                />
              );
            }}
          />
        </div>
      )}
    </FullPanel>
  );
};

export const createBankedDisassemblyPanel = ({ document, contents }: DocumentProps) => (
  <BankedDisassemblyPanel document={document} contents={contents} apiLoaded={() => {}} />
);
