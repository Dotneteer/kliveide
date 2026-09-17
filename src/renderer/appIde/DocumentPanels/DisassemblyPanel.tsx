import styles from "./DisassemblyPanel.module.scss";
import { useRowSizes } from "@renderer/theming/useRowSizes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import {
  CT_CUSTOM_DISASSEMBLER,
  CT_DISASSEMBLER,
  MF_Z80
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
import { useLaunchedNexAnnotations } from "./Next/useNexLiveBank";
import { createNexLiveOperandLabelResolver } from "./Next/nexLiveSymbols";
import { chainOperandLabelResolvers } from "../disassemblers/sys-var-operand-labels";
import { useSysVarOperandLabelResolver } from "./useSysVarOperandLabels";
import { evaluateBranch, type BranchVerdict } from "./branchVerdict";
import {
  buildPartitionIndexByLabel,
  resolveMem64kPartitions,
  resolveRowPartition,
  selectRowBreakpoint
} from "./breakpointRowMatch";
import { derivePartitionWidthCh } from "@renderer/controls/data/partitionWidth";
import { toHexa4 } from "../services/ide-commands";
import { useBreakpointDialog } from "../dialogs/useBreakpointDialog";
import { useAppServices } from "../services/AppServicesProvider";
import type { NavigationLocator } from "@renderer/abstractions/NavigationLocation";
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
  const { navigationHistoryService } = useAppServices();
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
  // --- On unless the reader turned it off: a named address is the more informative default, and a
  // --- panel that has never been configured should be the readable one.
  const [sysVarNames, setSysVarNames] = useState(
    loadedViewState?.sysVarNames ?? true
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

  // --- The live paging as partition *indices*. The emulator reports it as labels, and a breakpoint
  // --- names its partition by index, so the machine's label map is inverted once here instead of
  // --- once per visible row.
  const partitionIndexByLabel = useMemo(
    () => buildPartitionIndexByLabel(machineSetup.partitionLabels),
    [machineSetup.partitionLabels]
  );
  /*
   * The launched NEX's labels, for naming operands in the live listing.
   *
   * A factory over the paging rather than a finished resolver: `mem64kPartitions` below is derived
   * from what `useDisassemblyRefresh` *returns*, so handing it a resolver built from that would be
   * a cycle — and resolving from the previous refresh's paging would name from banks that have
   * since moved. The hook calls this with the paging it just read.
   *
   * Memoized on the annotations and the label map, because the hook depends on its identity: a
   * fresh function every render would re-disassemble 64K every render.
   */
  const launchedAnnotations = useLaunchedNexAnnotations();
  /*
   * The machine's system variables, as the second source of operand names.
   *
   * Independent of any NEX: every machine has one of these tables, so this is the source that makes
   * `ld (LAST_K),a` appear in an ordinary ZX Spectrum session. It is asked **after** the NEX labels
   * — see `chainOperandLabelResolvers` — because a label the user wrote about this program is a
   * more specific claim than a fact about the machine.
   */
  const machineSysVarLabelResolver = useSysVarOperandLabelResolver();
  // --- Withheld rather than filtered when the switch is off: an absent resolver is exactly the
  // --- listing as it was before the feature, with no naming path to go wrong.
  const sysVarLabelResolver = sysVarNames ? machineSysVarLabelResolver : undefined;
  const operandLabelSource = useMemo(
    () =>
      launchedAnnotations || sysVarLabelResolver
        ? (labels: string[]) =>
            chainOperandLabelResolvers(
              launchedAnnotations
                ? createNexLiveOperandLabelResolver(
                    launchedAnnotations,
                    resolveMem64kPartitions(labels, partitionIndexByLabel)
                  )
                : undefined,
              sysVarLabelResolver
            )
        : undefined,
    [launchedAnnotations, partitionIndexByLabel, sysVarLabelResolver]
  );

  const {
    breakpointMap,
    cpuSnapshot,
    items,
    mem64kLabels,
    pausedPc,
    refreshDisassembly,
    refreshVersion
  } = useDisassemblyRefresh({
    cachedRefreshState,
    customDisassembly,
    disassOffset,
    disassemblerFactory,
    emuApi,
    machineId,
    operandLabelSource,
    onFollowPcTopAddress: setFollowPcTopAddress
  });

  const mem64kPartitions = useMemo(
    () => resolveMem64kPartitions(mem64kLabels, partitionIndexByLabel),
    [mem64kLabels, partitionIndexByLabel]
  );

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
    sysVarNames,
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

  /*
   * Navigation history (Go Back / Go Forward).
   *
   * Where the listing is, for the history, is `pendingScrollTopAddress` — the top row as of the last
   * scroll frame, which a jump also sets synchronously so the location recorded right after it is
   * the address asked for, not the one before. See `.plans/NAVIGATION_HISTORY_PLAN.md` §4.2.
   *
   * Follow PC moves the listing too, but through `setFollowPcTopAddress`, never through a recorded
   * jump: that is the view following the machine, not the user going somewhere.
   */
  const navSegment = useRef(currentSegment);
  const navFullView = useRef(isFullView);
  navSegment.current = currentSegment;
  navFullView.current = isFullView;

  const jumpTo = useCallback((address: number) => {
    pendingScrollTopAddress.current = address;
    setToScroll(address);
    setScrollVersion((version) => version + 1);
  }, []);

  /*
   * A reveal that turned Follow PC off has to wait for the listing to be disassembled again: while
   * Follow PC is on, the listing covers only about a kilobyte around PC, so the address is usually
   * not in it yet, and the jump would report "outside the disassembled range" and give up.
   *
   * Keyed on `refreshVersion`, which counts completed refreshes, rather than on `items`: a refresh
   * that produces an equal listing is still the one this is waiting for. A Follow PC refresh already
   * under way when the switch flipped can still land first, with its small window; an address it
   * does not cover waits one more refresh before the jump is made regardless (and reports itself).
   */
  const pendingReveal = useRef<{ address: number; retried: boolean } | undefined>(undefined);
  useEffect(() => {
    const pending = pendingReveal.current;
    if (!pending || cachedRefreshState.current.autoRefresh) return;
    const covered =
      items.length > 0 &&
      items[0].address <= pending.address &&
      items[items.length - 1].address >= pending.address;
    if (!covered && !pending.retried) {
      pending.retried = true;
      return;
    }
    pendingReveal.current = undefined;
    jumpTo(pending.address);
    // --- `items` and `refreshVersion` are set in the same batch; both are named so the effect is
    // --- honest about what it reads, and a refresh with an equal listing still re-runs it.
  }, [items, refreshVersion, jumpTo]);

  const revealLocator = useRef<(locator: NavigationLocator) => void>(() => {});
  revealLocator.current = (locator: NavigationLocator) => {
    if (locator.kind !== "address") return;
    if (locator.fullView !== undefined && locator.fullView !== isFullView) {
      navFullView.current = locator.fullView;
      setIsFullView(locator.fullView);
    }
    if (locator.segment !== undefined && locator.segment !== null && locator.segment !== currentSegment) {
      navSegment.current = locator.segment;
      setCurrentSegment(locator.segment);
    }
    // --- Restoring a place the user left must not be overridden by the next Follow PC tick.
    if (autoRefresh) {
      pendingScrollTopAddress.current = locator.address;
      pendingReveal.current = { address: locator.address, retried: false };
      setAutoRefresh(false);
      return;
    }
    jumpTo(locator.address);
  };

  useEffect(() => {
    documentHubService.setDocumentApi(document.id, {
      getNavigationLocator: () => ({
        kind: "address",
        address: pendingScrollTopAddress.current ?? 0,
        segment: navSegment.current,
        fullView: navFullView.current,
        viewMode: "disassembly"
      }),
      revealLocator: (locator) => revealLocator.current(locator)
    });
    return () => documentHubService.setDocumentApi(document.id, undefined);
  }, [document.id, documentHubService]);

  // --- Initial view: refresh the disassembly list and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshDisassembly();
    setScrollVersion((version) => version + 1);
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (items.length === 0 || toScroll === null) return;

    const idx = items.findIndex((di) => di.address >= toScroll);
    if (idx >= 0) {
      vlApi.current?.scrollToIndex(idx, {
        align: "start"
      });
    } else {
      /*
       * Asked for an address past the last disassembled instruction.
       *
       * The listing is not the whole 64K: with the 64K view off it covers only the selected bank
       * ($0000-$3FFF), and while Follow PC is on only about a kilobyte around PC. So a perfectly
       * valid address is often outside it — and this used to discard the request without a word,
       * which is indistinguishable from Go To being broken.
       *
       * An address *below* the range needs no special case: `findIndex` lands on the first
       * instruction at or after it, which is the top of the listing.
       */
      dispatch(
        setIdeStatusMessageAction(
          `$${toHexa4(toScroll)} is outside the disassembled range ` +
            `($${toHexa4(items[0].address)}-$${toHexa4(items[items.length - 1].address)}). ` +
            `Turn on the 64K view, or turn off Follow PC, to reach it.`,
          true
        )
      );
    }
    setToScroll(null);
  }, [items, scrollVersion, toScroll, dispatch]);

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
    emuViewVersion,
    // --- Operand names arrive asynchronously — the system variable table over IPC, a launched
    // --- NEX's labels from its sidecar — so they are usually not there yet when the listing is
    // --- first decoded. Without this, a stopped machine would keep showing `$5C08` until something
    // --- else happened to invalidate the listing. The source is memoized, so this fires once.
    operandLabelSource
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

  /*
   * Whether this listing shows branch verdicts at all.
   *
   * Two gates, and both are decisions rather than conveniences:
   *
   * - **The machine must be started** (decision 2). Stopped, there is no CPU state to predict from,
   *   so the listing must render exactly as it always has - no gutter, no reserved width, no shifted
   *   columns. `Running` counts as well as `Paused`: the sample is up to 750ms old, which is
   *   accepted, and the panel already refreshes on that same cadence.
   * - **The CPU must be a Z80 or Z80N.** The branch tables are Z80 opcode tables; a 6510 listing
   *   would be read against the wrong instruction set entirely. The same `MF_Z80` feature flag the
   *   sidebar uses to decide whether to show the Z80 CPU panel.
   */
  const showBranchGutter =
    !!machineInfo?.features?.[MF_Z80] &&
    !!cpuSnapshot &&
    (machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused);

  /*
   * Every visible row's verdict, computed once per refresh rather than once per row.
   *
   * `DisassemblyRow` is memoized, so handing each row a freshly built object on every render would
   * re-render the whole listing on every tick and defeat the memo. Keyed by address, built here,
   * and each row is handed the same object identity until something it depends on actually changes.
   */
  const branchVerdicts = useMemo(() => {
    if (!showBranchGutter || !cpuSnapshot) return undefined;
    const verdicts = new Map<number, BranchVerdict>();
    for (const item of items) {
      if (!item.branch) continue;
      verdicts.set(
        item.address,
        evaluateBranch(
          item.branch,
          item.address,
          item.opCodes?.length ?? 0,
          cpuSnapshot,
          item.address === pausedPc
        )
      );
    }
    return verdicts;
  }, [showBranchGutter, cpuSnapshot, items, pausedPc]);

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
        onGoToAddress={(address) =>
          void navigationHistoryService.recordJump("disassemblyGoTo", () => jumpTo(address))
        }
        onGoToPc={() =>
          void navigationHistoryService.recordJump("disassemblyGoTo", () => jumpTo(pausedPc))
        }
        onManualRefresh={async () => {
          await refreshDisassembly();
          dispatch(setIdeStatusMessageAction("Disassembly refreshed", true));
        }}
        onRamChanged={setRam}
        onScreenChanged={setScreen}
        onShowBankLabelChanged={setBankLabel}
        onSysVarNamesChanged={setSysVarNames}
        pausedPc={pausedPc}
        ram={ram}
        screen={screen}
        sysVarNames={sysVarNames}
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
                  breakpoint={selectRowBreakpoint(
                    breakpointMap.get(item.address),
                    resolveRowPartition(
                      item.address,
                      isFullView,
                      currentSegment,
                      mem64kPartitions
                    )
                  )}
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
                  showBranchGutter={showBranchGutter}
                  verdict={branchVerdicts?.get(item.address)}
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
