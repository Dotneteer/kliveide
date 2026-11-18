import styles from "./DisassemblyPanel.module.scss";
import { ExportSourceButton, ReverseToolsMenu } from "@renderer/appIde/reverse/ReverseToolsMenu";
import { LIVE_VIEW_EXPORT_SCOPE } from "@common/reverse/sourceExportUi";
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
import { useMainApi } from "@renderer/core/MainApi";
import {
  type CachedRefreshState,
  useDisassemblyViewStatePersistence,
  useLoadedDisassemblyViewState
} from "./disassemblyViewState";
import { useDisassemblyMachineSetup } from "./useDisassemblyMachineSetup";
import {
  type DisassemblerFactory,
  type LiveListingContext,
  useDisassemblyRefresh
} from "./useDisassemblyRefresh";
import { DisassemblyRow, deriveDisassemblyRowViewModel, deriveInstructionWidthCh } from "./DisassemblyRow";
import { hasMachineFeature } from "@common/features/advancedDebugging";
import { MF_PROFILE } from "@common/machines/constants";
import { PF_EXECUTED } from "@common/profile/profileTypes";
import { useAddressSymbols } from "@renderer/appIde/annotations/useAddressSymbols";
import { getRomPartition, useRomLayersOf } from "@renderer/appIde/annotations/romAnnotations";
import { customDisassemblyContextFor } from "@renderer/appIde/annotations/romDisassemblyGate";
import {
  annotateLiveListing,
  partitionSite
} from "@renderer/appIde/annotations/liveAnnotatedDisassembly";
import { machineCharSetOf } from "@renderer/appIde/annotations/machineCharSet";
import { useSysVarOperandLabelResolver } from "./useSysVarOperandLabels";
import { evaluateBranch, type BranchVerdict } from "./branchVerdict";
import {
  buildPartitionIndexByLabel,
  resolveMem64kPartitions,
  resolveRowPartition,
  selectRowBreakpoint
} from "./breakpointRowMatch";
import { derivePartitionWidthCh } from "@renderer/controls/data/partitionWidth";
import { toHexa2, toHexa4 } from "../services/ide-commands";
import { useT } from "@common/i18n/useT";
import { useBreakpointDialog } from "../dialogs/useBreakpointDialog";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import type { DisassemblyItem } from "../disassemblers/common-types";
import { useLiveAnnotationEditing } from "@renderer/appIde/annotations/useLiveAnnotationEditing";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@controls/ContextMenu";
import { disassemblyRowMenuItems, type RowMenuTarget } from "./disassemblyRowMenu";
import { useAppServices } from "../services/AppServicesProvider";
import type { NavigationLocator } from "@renderer/abstractions/NavigationLocation";
import { HistoryPresentBanner } from "../debugger/history/HistoryPresentBanner";
import classnames from "classnames";
import frame from "@renderer/features/memoryMap/MemoryMap.module.scss";
import { Check, FindBox, GoToBox, Segmented, ToolGroup } from "@renderer/features/memoryMap/FrameControls";
import { MemoryMapBar, PartitionBar } from "@renderer/features/memoryMap/MemoryMapBar";
import { PartitionRow } from "@renderer/features/memoryMap/PartitionRow";
import { RegisterStrip } from "@renderer/features/memoryMap/RegisterStrip";
import { usePartitionInfo } from "@renderer/features/memoryMap/usePartitionInfo";
import { useNamedLocations } from "@renderer/features/memoryMap/useNamedLocations";
import { GO_TO_ERROR_KEYS, parseGoToTarget, suggestLabels, type GoToTarget } from "@renderer/features/memoryMap/goToTarget";
import {
  buildMapCells,
  cpuAddressOf,
  pagedSlotsOf,
  partitionAt,
  pushRecent,
  registerValuesOf
} from "@renderer/features/memoryMap/memoryMapModel";
import { kindText } from "@renderer/features/memoryMap/partitionText";
import { edgesAt, layoutFlow } from "./flowGutter";
import { buildListingRows } from "./listingRows";
import { DisassemblyInspector, type InspectedOperand } from "./DisassemblyInspector";
import { InspectorEmpty } from "@renderer/features/memoryMap/Inspector";
import { printedReferences, rowLabelName } from "./printedReferences";
import { SmallIconButton } from "@renderer/controls/IconButton";

/* M3: see `MemoryPanel` — the height belongs to `rowSizes`, not to this file. */
const BankedDisassemblyPanel = ({ document }: DocumentProps) => {
  // --- M3: the row height the virtualizer places by, matching `--row-size-disassembly` in the CSS.
  const { disassembly: disassemblyRowItemSize } = useRowSizes();
  // --- Get the services used in this component
  const t = useT();
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

  /*
   * The row menu (`dev/plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §4.2): the gutter's gestures,
   * named, on a right-click anywhere on the row outside the gutter (which keeps its own right-click
   * toggle). Stable, so the memoized rows are not re-rendered by it.
   */
  const { ideCommandsService, projectService } = useAppServices();
  const [rowMenuState, rowMenuApi] = useContextMenuState();
  const [rowMenuTarget, setRowMenuTarget] = useState<RowMenuTarget | undefined>(undefined);
  const openRowMenu = useCallback(
    (target: RowMenuTarget, event: ReactMouseEvent) => {
      event.preventDefault();
      setRowMenuTarget(target);
      rowMenuApi.show(event);
    },
    [rowMenuApi]
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
  const [bankLabel] = useState(
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
  // --- The ROM's annotations (§5.5), on unless the reader turned them off
  const [romLabels, setRomLabels] = useState(loadedViewState?.romLabels ?? true);
  // --- The frame (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §4, §6)
  const [flowOn, setFlowOn] = useState(loadedViewState?.flow ?? true);
  const [inspectorShown, setInspectorShown] = useState(loadedViewState?.inspector ?? true);
  const [recent, setRecent] = useState<number[]>([]);
  const [bankMapOpen, setBankMapOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [findMatches, setFindMatches] = useState<number[] | undefined>();
  const [findIndex, setFindIndex] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { set: partitionSet, partitions } = usePartitionInfo(emuApi);

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
   * The machine's system variables, the last source of operand names.
   *
   * Independent of any program: every machine has one of these tables, so this is the source that
   * makes `ld (LAST_K),a` appear in an ordinary ZX Spectrum session. It is asked **after** every
   * label source — a label someone wrote about this program or ROM is a more specific claim than a
   * fact about the machine.
   */
  const machineSysVarLabelResolver = useSysVarOperandLabelResolver();
  // --- Withheld rather than filtered when the switch is off: an absent resolver is exactly the
  // --- listing as it was before the feature, with no naming path to go wrong.
  const sysVarLabelResolver = sysVarNames ? machineSysVarLabelResolver : undefined;
  /*
   * The shared resolver (`annotations/symbolResolver.ts`): build symbols, the active annotation set,
   * the ROM's annotations and the system variables, in that order (A8). It follows the active set's
   * session, so a label added from anywhere is on screen at the next refresh.
   */
  const { symbols, bankSpace } = useAddressSymbols(projectService, {
    romLabels,
    sysVarResolver: sysVarLabelResolver
  });
  const hasRomAnnotations = !!useRomLayersOf();
  const machineCharSet = useMemo(() => machineCharSetOf(machineId), [machineId]);
  /*
   * A factory over the paging rather than a finished resolver: the paging arrives with the memory
   * read `useDisassemblyRefresh` performs, and naming from the previous refresh's paging would name
   * from banks that have since moved. Memoized on the resolver, because the hook depends on its
   * identity: a fresh function every render would re-disassemble 64K every render.
   */
  const operandLabelSource = useMemo(
    () =>
      symbols.empty && !sysVarLabelResolver
        ? undefined
        : (labels: string[], slots?: (number | undefined)[]) =>
            symbols.operandResolver(slots ?? resolveMem64kPartitions(labels, partitionIndexByLabel)),
    [symbols, sysVarLabelResolver, partitionIndexByLabel]
  );
  // --- The custom disassembler decodes RST data only inside the ROM it describes (§4.5)
  const romLayersVersion = useRomLayersOf();
  const customDisassemblyContext = useCallback(
    (slots: (number | undefined)[] | undefined, partition: number | undefined) =>
      customDisassemblyContextFor(
        machineId,
        bankSpace,
        slots,
        (rom) => getRomPartition(rom)?.source,
        partition
      ),
    // --- The ROM identities arrive with the layers
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [machineId, bankSpace, romLayersVersion]
  );
  // --- The annotated listing: banks and ROM pages re-listed from their regions (§4.5)
  const annotateItems = useMemo(
    () =>
      symbols.empty || !bankSpace
        ? undefined
        : (context: LiveListingContext) => {
            const slots = context.slots;
            const site =
              context.partition !== undefined ? partitionSite(context.partition, bankSpace) : undefined;
            return annotateLiveListing({
              items: context.items,
              memory: context.memory,
              memoryBase: context.memoryBase,
              ranges: context.ranges,
              pieces: site
                ? [
                    {
                      start: context.memoryBase,
                      end: context.memoryBase + context.memory.length - 1,
                      site
                    }
                  ]
                : undefined,
              space: bankSpace,
              slots,
              symbols,
              decimalView: context.decimalView,
              pc: context.partition === undefined ? context.pc : undefined,
              allowExtendedSet: bankSpace.extendedSet,
              prepareDisassembler: context.prepareDisassembler,
              fallbackOperandLabelResolver: operandLabelSource?.([], slots),
              charSet: machineCharSet
            });
          },
    [symbols, bankSpace, operandLabelSource, machineCharSet]
  );

  const {
    breakpointMap,
    cpuSnapshot,
    history,
    items,
    mem64kLabels,
    memorySnapshot,
    pausedPc,
    refreshDisassembly,
    refreshVersion,
    registers: refreshRegisters,
    partitionRoles
  } = useDisassemblyRefresh({
    cachedRefreshState,
    customDisassembly,
    disassOffset,
    disassemblerFactory,
    emuApi,
    machineId,
    operandLabelSource,
    annotateItems,
    customDisassemblyContext,
    onFollowPcTopAddress: setFollowPcTopAddress
  });

  /*
   * Editing annotations from the listing (§4.5): the row menu's annotation entries and the bank
   * document's shortcuts, acting on the bank or ROM page a row is in. The shortcuts act on the row
   * last clicked; a handled key stops propagating, because the emulated keyboard listens on
   * `window` while a machine runs.
   */
  // --- `jumpTo` is declared further down; the editor reaches it through a ref
  const jumpToRef = useRef<(address: number) => void>();
  const annotationEditing = useLiveAnnotationEditing({
    items,
    memorySnapshot,
    bankSpace,
    decimalView,
    navigateToAddress: (address) => void jumpToRef.current?.(address)
  });
  const [annotationRow, setAnnotationRow] = useState<DisassemblyItem | undefined>(undefined);
  const selectAnnotationRow = useCallback((item: DisassemblyItem) => setAnnotationRow(item), []);
  const handleAnnotationKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.metaKey || event.altKey) return;
      const action = annotationEditing.actionForKey(
        annotationRow,
        event.key,
        event.shiftKey,
        event.ctrlKey
      );
      if (!action || !annotationRow) return;
      event.preventDefault();
      event.stopPropagation();
      void annotationEditing.run(annotationRow, action);
    },
    [annotationEditing, annotationRow]
  );

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
    romLabels,
    topAddress,
    flow: flowOn,
    inspector: inspectorShown
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
   * the address asked for, not the one before. See `dev/plans/NAVIGATION_HISTORY_PLAN.md` §4.2.
   *
   * Follow PC moves the listing too, but through `setFollowPcTopAddress`, never through a recorded
   * jump: that is the view following the machine, not the user going somewhere.
   */
  const navSegment = useRef(currentSegment);
  const navFullView = useRef(isFullView);
  const navBase = useRef(disassOffset);
  navSegment.current = currentSegment;
  navFullView.current = isFullView;
  navBase.current = disassOffset;

  const jumpTo = useCallback((address: number) => {
    pendingScrollTopAddress.current = address;
    setToScroll(address);
    setScrollVersion((version) => version + 1);
  }, []);
  jumpToRef.current = jumpTo;

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
      if (locator.fullView === false) setRecent((r) => pushRecent(r, locator.segment!));
    }
    // --- A partition listing's Origin, as the location was recorded (or `show-disass PART:offset`)
    if (locator.fullView === false && locator.base !== undefined && locator.base !== disassOffset) {
      navBase.current = locator.base;
      setDisassOffset(locator.base);
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
        ...(navFullView.current ? {} : { base: navBase.current }),
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
          t("panels.doc.disassembly.outsideRange", {
            address: `$${toHexa4(toScroll)}`,
            from: `$${toHexa4(items[0].address)}`,
            to: `$${toHexa4(items[items.length - 1].address)}`
          }),
          true
        )
      );
    }
    setToScroll(null);
  }, [items, scrollVersion, toScroll, dispatch, t]);

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

  // --- Re-list when a name source changes: a label added from a bank document, the live view or
  // --- the `label` command, a compilation, the ROM's annotations. Skips the first render, which the
  // --- effects below already refresh.
  const namesSeen = useRef(false);
  useEffect(() => {
    if (!namesSeen.current) {
      namesSeen.current = true;
      return;
    }
    void refreshDisassembly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotateItems, operandLabelSource]);

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

  /*
   * Code coverage's cell (`dev/plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D13): reserved on every row
   * once coverage has recorded anything, so the columns after it line up (the branch gutter's
   * pattern). Each row's own partition decides which bank's byte is asked about (D11). One number
   * per row - undefined: no data; 0: never started; -1: started, count not kept; n: started n
   * times - so the memoized row compares it by value.
   */
  const coverageAvailable = useSelector((s) =>
    hasMachineFeature(
      machineRegistry.find((m) => m.machineId === s.emulatorState?.machineId),
      MF_PROFILE,
      s
    )
  );
  const profileVersion = useSelector((s) => s.emulatorState?.profileVersion);
  const [coverageMarks, setCoverageMarks] = useState<Map<number, number> | undefined>();
  // --- The profiler's share of the time per row, in tenths of a percent (`dev/plans/PROFILER_PLAN.md` D15)
  const [timeShares, setTimeShares] = useState<Map<number, number> | undefined>();
  useEffect(() => {
    if (!coverageAvailable || items.length === 0) {
      setCoverageMarks(undefined);
      return undefined;
    }
    let cancelled = false;
    const partitions = items.map((item) => resolveRowPartition(item.address, isFullView, currentSegment, mem64kPartitions) ?? null);
    void emuApi
      .getProfileSample(
        items.map((item) => item.address),
        partitions,
        true
      )
      .then((sample) => {
        if (cancelled) return;
        if (!sample || (!sample.info.enabled && sample.info.instructions === 0)) {
          setCoverageMarks(undefined);
          setTimeShares(undefined);
          return;
        }
        const marks = new Map<number, number>();
        const shares = new Map<number, number>();
        const total = sample.info.timeTotal;
        items.forEach((item, i) => {
          const executed = (sample.flags[i] & PF_EXECUTED) !== 0;
          marks.set(item.address, !executed ? 0 : sample.exec ? sample.exec[i] || -1 : -1);
          const time = sample.time?.[i] ?? 0;
          if (executed && time > 0 && total > 0) shares.set(item.address, Math.round((1000 * time) / total) / 10);
        });
        setCoverageMarks(marks);
        setTimeShares(shares.size ? shares : undefined);
      })
      .catch(() => {
        if (!cancelled) {
          setCoverageMarks(undefined);
          setTimeShares(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [coverageAvailable, items, profileVersion, isFullView, currentSegment, mem64kPartitions, emuApi]);

  // --- Sized to the longest row, as the static listing is: a `.defw` row whose words are label
  // --- names outgrows the default and would otherwise wrap over the row below.
  const instructionWidthCh = useMemo(() => deriveInstructionWidthCh(items), [items]);
  const commentWidthCh = useMemo(
    () =>
      items.reduce(
        (widest, item) => (item.hardComment ? Math.max(widest, item.hardComment.length + 2) : widest),
        0
      ),
    [items]
  );

  // ─── The frame (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §4) ─────────────────────────────

  const slots = memorySnapshot?.slots ?? mem64kPartitions;
  // --- A machine without partitions draws its map from the ROM flags
  const [romFlags, setRomFlags] = useState<boolean[]>([]);
  useEffect(() => {
    let cancelled = false;
    emuApi
      .getRomFlags()
      .then((flags) => !cancelled && setRomFlags(flags ?? []))
      .catch(() => !cancelled && setRomFlags([]));
    return () => {
      cancelled = true;
    };
  }, [emuApi, machineId]);
  const mapCells = useMemo(() => buildMapCells(slots, partitions, romFlags), [slots, partitions, romFlags]);
  const paged = useMemo(() => pagedSlotsOf(slots), [slots]);
  const registers = useMemo(() => (refreshRegisters ? registerValuesOf(refreshRegisters) : undefined), [refreshRegisters]);
  const shownPartition = !isFullView ? partitions.get(currentSegment) : undefined;
  const hasPartitions = !!partitionSet && partitionSet.partitions.length > 0;
  const namedLocations = useNamedLocations(symbols);

  /*
   * The rows the list shows: the listing, with a rule row where the 64K view enters another slot
   * (§6.1) and an empty Z88 card slot folded into one row instead of 16K of `rst $38`. Display only:
   * the annotation, breakpoint and coverage logic keep reading `items`.
   */
  const rows = useMemo(
    () =>
      !isFullView || !hasPartitions
        ? items
        : buildListingRows(items, mapCells, partitions, {
            slotRule: (c) => {
              const range = `$${toHexa4(c.start)}–$${toHexa4(c.end)}`;
              const part = c.name ? ` · ${c.name}${c.description ? ` ${c.description}` : ""}` : "";
              return `${t("panels.doc.disassembly.slotRule", { slot: c.slots.join("·") })} · ${range}${part}`;
            },
            emptySlot: (slot) => t("panels.doc.disassembly.emptySlot", { slot })
          }),
    [items, isFullView, hasPartitions, mapCells, partitions, t]
  );

  // --- The flow gutter, computed once per listing (risk "Performance")
  const flowLayout = useMemo(() => (flowOn ? layoutFlow(rows) : undefined), [flowOn, rows]);
  const selectedRow = annotationRow ? rows.indexOf(annotationRow) : -1;
  const highlighted = useMemo(
    () => (flowLayout && selectedRow >= 0 ? edgesAt(flowLayout, selectedRow) : undefined),
    [flowLayout, selectedRow]
  );
  // --- The branch taken at PC, in the verdict hue
  const takenEdge = useMemo(() => {
    if (!flowLayout || !branchVerdicts) return undefined;
    const pcRow = rows.findIndex((r) => !r.separator && r.address === pausedPc);
    if (pcRow < 0 || !branchVerdicts.get(pausedPc)?.taken) return undefined;
    return flowLayout.rows.get(pcRow)?.find((p) => p.kind === "source" || p.kind === "stubOut")?.edge;
  }, [flowLayout, branchVerdicts, rows, pausedPc]);

  // --- Reference counts on label rows (§6.1)
  const references = useMemo(() => printedReferences(rows), [rows]);

  // ─── Going places ─────────────────────────────────────────────────────────────────────────────

  const selectView = useCallback((partition: number | undefined) => {
    setAutoRefresh(false);
    if (partition === undefined) {
      navFullView.current = true;
      setIsFullView(true);
    } else {
      navFullView.current = false;
      navSegment.current = partition;
      setIsFullView(false);
      setCurrentSegment(partition);
      setRecent((r) => pushRecent(r, partition));
      // --- At its Origin: where the partition is paged in, else $0000 (§4.3)
      const p = partitions.get(partition);
      const at = p ? cpuAddressOf(slots, partition, 0, p.size) : undefined;
      setDisassOffset(at !== undefined ? at & 0xe000 : 0);
    }
  }, [partitions, slots]);

  const goToTarget = useCallback(
    (target: GoToTarget) =>
      void navigationHistoryService.recordJump("disassemblyGoTo", () => {
        if (target.kind === "address") {
          // --- A number stays in the view (a partition's listing is at its Origin); a register
          // --- or a label names a CPU address, which the 64K view shows
          if (!isFullView && target.via !== "number") {
            navFullView.current = true;
            setIsFullView(true);
          }
          // --- As Go To always did: a jump within the listing, which says so when the address is
          // --- outside it (Follow PC lists about a kilobyte around PC)
          jumpTo(target.address);
        } else {
          const p = partitions.get(target.partition);
          const at = p ? cpuAddressOf(slots, target.partition, 0, p.size) : undefined;
          const origin = at !== undefined ? at & 0xe000 : 0;
          navFullView.current = false;
          navSegment.current = target.partition;
          setAutoRefresh(false);
          setIsFullView(false);
          setCurrentSegment(target.partition);
          setDisassOffset(origin);
          setRecent((r) => pushRecent(r, target.partition));
          pendingScrollTopAddress.current = origin + target.offset;
          pendingReveal.current = { address: origin + target.offset, retried: false };
        }
      }),
    [navigationHistoryService, isFullView, partitions, slots, jumpTo]
  );

  const goToText = (text: string): string | undefined => {
    const result = parseGoToTarget(text, {
      decimal: decimalView,
      registers,
      partitionLabels: machineSetup.partitionLabels,
      partitionSize: (id) => partitions.get(id)?.size,
      slotPartitions: slots,
      labels: namedLocations
    });
    if ("error" in result) return result.error === "empty" ? undefined : t(GO_TO_ERROR_KEYS[result.error]);
    goToTarget(result.target);
    return undefined;
  };

  /** Scroll to a row and select it */
  const revealRow = useCallback((rowIndex: number) => {
    const row = rows[rowIndex];
    if (!row) return;
    const top = Math.max(0, rowIndex - 3);
    // --- The history reads where the listing is right after the jump (NAVIGATION_HISTORY_PLAN §4.2)
    pendingScrollTopAddress.current = rows[top].address;
    vlApi.current?.scrollToIndex(top, { align: "start" });
    if (!row.separator) setAnnotationRow(row);
  }, [rows]);

  const showInMemory = useCallback(
    (address: number) => {
      const at = isFullView ? partitionAt(slots, partitions, address) : undefined;
      // --- In the 64K view the address is the CPU's; a partition on its own names partition and offset
      const spec = isFullView
        ? `$${toHexa4(address)}`
        : shownPartition
          ? `${shownPartition.name}:$${toHexa4((address - disassOffset) & (shownPartition.size - 1))}`
          : `$${toHexa4(address)}`;
      void at;
      void navigationHistoryService.recordJump("disassemblyGoTo", () =>
        ideCommandsService.executeCommand(`show-memory ${spec}`)
      );
    },
    [isFullView, slots, partitions, shownPartition, disassOffset, navigationHistoryService, ideCommandsService]
  );

  // ─── Find (§6.3): over the listing's printed text ────────────────────────────────────────────

  const runFind = () => {
    const query = findText.trim().toLowerCase();
    if (!query) return;
    const matches: number[] = [];
    rows.forEach((row, index) => {
      if (row.separator || row.prefixComment !== undefined) return;
      const text = `${row.formattedLabel ?? ""} ${row.instruction ?? ""} ${row.hardComment ?? ""}`.toLowerCase();
      if (text.includes(query)) matches.push(index);
    });
    setFindMatches(matches);
    const start = Math.max(0, selectedRow);
    const first = Math.max(0, matches.findIndex((m) => m >= start));
    setFindIndex(first);
    if (matches.length) revealRow(matches[first]);
  };
  const stepFind = (delta: 1 | -1) => {
    if (!findMatches?.length) return;
    const next = (findIndex + delta + findMatches.length) % findMatches.length;
    setFindIndex(next);
    revealRow(findMatches[next]);
  };

  // ─── Keyboard: rows, the Bank map, Go to, Find, Show in Memory ───────────────────────────────

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && (event.key === "b" || event.key === "B")) {
      event.preventDefault();
      if (partitionSet && partitionSet.partitions.length > 16) setBankMapOpen((o) => !o);
      return;
    }
    if (ctrl && (event.key === "g" || event.key === "G" || event.key === "f" || event.key === "F")) {
      event.preventDefault();
      const inputs = toolbarRef.current?.querySelectorAll("input[type='text'], input:not([type])");
      (inputs?.[event.key.toLowerCase() === "g" ? 0 : 1] as HTMLInputElement | undefined)?.focus();
      return;
    }
    if (ctrl && (event.key === "m" || event.key === "M")) {
      event.preventDefault();
      if (annotationRow) showInMemory(annotationRow.address);
      return;
    }
    if (event.key === "F3") {
      event.preventDefault();
      stepFind(event.shiftKey ? -1 : 1);
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !event.altKey && !ctrl) {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      let at = selectedRow < 0 ? (vlApi.current?.findStartIndex() ?? 0) : selectedRow + delta;
      while (rows[at]?.separator || rows[at]?.prefixComment !== undefined) at += delta;
      if (!rows[at]) return;
      setAnnotationRow(rows[at]);
      const start = vlApi.current?.findStartIndex() ?? 0;
      const visible = Math.floor((vlApi.current?.viewportSize ?? 400) / disassemblyRowItemSize);
      if (at < start || at >= start + visible - 1) {
        vlApi.current?.scrollToIndex(delta > 0 ? Math.max(0, at - visible + 2) : at, { align: "start" });
      }
      return;
    }
    handleAnnotationKeyDown(event);
  };

  // ─── The inspector's facts about the selected row ─────────────────────────────────────────────

  const inspectedOperands = useMemo((): InspectedOperand[] => {
    const item = annotationRow;
    if (!item) return [];
    const memory = memorySnapshot?.memory;
    const base = memorySnapshot?.memoryBase ?? 0;
    const bytesAt = (address: number) => {
      if (!memory || !isFullView) return undefined;
      const out: number[] = [];
      for (let i = 0; i < 8; i++) {
        const index = address + i - base;
        if (index < 0 || index >= memory.length) break;
        out.push(memory[index]);
      }
      return out.length ? out : undefined;
    };
    const partOf = (address: number) => {
      const at = partitionAt(slots, partitions, address);
      const p = at ? partitions.get(at.partition) : undefined;
      return p && at ? `${p.name}:$${toHexa4(at.offset)}` : undefined;
    };
    const result: InspectedOperand[] = [];
    for (const operand of item.operandCandidates ?? []) {
      result.push({
        text: operand.defaultText,
        name: operand.resolvedText,
        address: operand.operandValue,
        partition: partOf(operand.operandValue),
        bytes: bytesAt(operand.operandValue)
      });
    }
    // --- (HL), (DE), (BC), (IX+d), (IY+d): where it points as the instruction runs
    const indirect = /\((hl|de|bc|ix|iy)([+-]\$?[0-9a-f]+)?\)/i.exec(item.instruction ?? "");
    if (indirect && registers) {
      const reg = indirect[1].toUpperCase();
      let address = registers[reg] ?? 0;
      if (indirect[2]) {
        const sign = indirect[2][0] === "-" ? -1 : 1;
        const num = indirect[2].slice(1).replace("$", "");
        address = (address + sign * parseInt(num, indirect[2].includes("$") ? 16 : 10)) & 0xffff;
      }
      result.push({ text: indirect[0], address, viaRegister: reg, partition: partOf(address), bytes: bytesAt(address) });
    }
    // --- NEXTREG reg,value: the register it writes
    const nextreg = /^nextreg\s+\$?([0-9a-f]+)/i.exec(item.instruction ?? "");
    if (nextreg) {
      const reg = parseInt(nextreg[1], item.instruction!.includes("$") || /[a-f]/i.test(nextreg[1]) ? 16 : 10);
      result.push({ text: `$${toHexa2(reg)}`, address: reg, nextReg: reg });
    }
    return result;
  }, [annotationRow, memorySnapshot, isFullView, slots, partitions, registers]);

  const inspectedReferences = useMemo(() => {
    const name = annotationRow ? rowLabelName(annotationRow) : undefined;
    if (!name) return undefined;
    const list = references.get(name);
    return (list ?? []).map((rowIndex) => ({
      rowIndex,
      address: rows[rowIndex].address,
      text: rows[rowIndex].instruction ?? ""
    }));
  }, [annotationRow, references, rows]);

  /** A label's reference count was clicked: select its row, the inspector lists the references */
  const openReferences = useCallback((item: DisassemblyItem) => {
    setAnnotationRow(item);
    setInspectorShown(true);
  }, []);

  /** What the gutter's commands name a row by, as the row itself derives it */
  const rowSpecOf = (item: DisassemblyItem) => {
    const vm = deriveDisassemblyRowViewModel({
      bankLabel,
      breakpoint: undefined,
      currentSegment,
      decimalView,
      isFullView,
      item,
      mem64kLabels,
      partitionLabels: machineSetup.partitionLabels,
      pausedPc,
      showBanks: machineSetup.showBanks
    });
    return typeof vm.breakpointAddress === "number" ? `$${toHexa4(vm.breakpointAddress)}` : vm.breakpointAddress;
  };

  const selectedLocation = useMemo(() => {
    if (!annotationRow) return undefined;
    if (!isFullView && shownPartition) {
      return `${shownPartition.name}:$${toHexa4((annotationRow.address - disassOffset) & (shownPartition.size - 1))}`;
    }
    const at = partitionAt(slots, partitions, annotationRow.address);
    const p = at ? partitions.get(at.partition) : undefined;
    return p && at ? `${p.name}:$${toHexa4(at.offset)}` : undefined;
  }, [annotationRow, isFullView, shownPartition, disassOffset, slots, partitions]);
  const selectedPartition = annotationRow
    ? isFullView
      ? partitions.get(resolveRowPartition(annotationRow.address, true, currentSegment, mem64kPartitions) ?? NaN)
      : shownPartition
    : undefined;
  const flowKeyOf = (index: number) => {
    const pieces = flowLayout?.rows.get(index);
    if (!pieces) return undefined;
    return pieces.map((p) => `${p.edge}${highlighted?.has(p.edge) ? "h" : ""}${p.edge === takenEdge ? "t" : ""}`).join(",");
  };

  const machineStarted =
    machineState === MachineControllerState.Paused || machineState === MachineControllerState.Stopped;
  return (
    <div className={frame.document}>
      {/* ─── Toolbar (§4.1, §6) ──────────────────────────────────────────────────────── */}
      <div className={frame.toolbar} ref={toolbarRef}>
        <GoToBox
          placeholder={t("panels.memoryMap.goToPlaceholder")}
          title={t("panels.memoryMap.goToTitle")}
          suggestions={(text) => suggestLabels(text, namedLocations)}
          onGo={goToText}
        />
        <button
          type="button"
          className={frame.button}
          disabled={!machineStarted}
          title={t("panels.doc.disassembly.goToPc")}
          onClick={() => goToTarget({ kind: "address", address: pausedPc })}
        >
          ▶ PC
        </button>
        <Check
          label={t("panels.doc.disassembly.followPc")}
          title={t("panels.doc.disassembly.followPcTitle")}
          value={autoRefresh}
          onChange={(value) => {
            setAutoRefresh(value);
            if (value) {
              setIsFullView(true);
              setToScroll(0);
            }
            setScrollVersion((version) => version + 1);
          }}
        />
        <SmallIconButton
          iconName="refresh"
          title={t("panels.doc.common.refreshNow")}
          clicked={async () => {
            await refreshDisassembly();
            dispatch(setIdeStatusMessageAction(t("panels.doc.disassembly.refreshed"), true));
          }}
        />
        <FindBox
          placeholder={t("panels.doc.disassembly.findPlaceholder")}
          title={t("panels.doc.disassembly.findTitle")}
          text={findText}
          count={findMatches?.length}
          index={findIndex}
          onTextChange={(text) => {
            setFindText(text);
            setFindMatches(undefined);
          }}
          onSearch={runFind}
          onStep={stepFind}
        />
        <Segmented
          label={t("panels.memoryView.numberFormat")}
          value={decimalView ? "dec" : "hex"}
          options={[
            { value: "hex", text: t("panels.memoryView.hex"), title: t("panels.memoryView.hexTitle") },
            { value: "dec", text: t("panels.memoryView.dec"), title: t("panels.doc.disassembly.decimalTitle") }
          ]}
          onChange={(v) => setDecimalView(v === "dec")}
        />
        <Check label={t("panels.doc.disassembly.sysVars")} title={t("panels.doc.disassembly.sysVarsTitle")} value={sysVarNames} onChange={setSysVarNames} />
        {hasRomAnnotations && (
          <Check label={t("panels.doc.disassembly.romLabels")} title={t("panels.doc.disassembly.romLabelsTitle")} value={romLabels} onChange={setRomLabels} />
        )}
        <Check label={t("panels.doc.disassembly.flow")} title={t("panels.doc.disassembly.flowTitle")} value={flowOn} onChange={setFlowOn} />
        {machineSetup.allowViews && (
          <ToolGroup>
            <Check label={t("panels.doc.disassembly.ram")} title={t("panels.doc.disassembly.ramTitle")} value={ram} onChange={setRam} />
            <Check label={t("panels.doc.disassembly.screen")} title={t("panels.doc.disassembly.screenTitle")} value={screen} onChange={setScreen} />
          </ToolGroup>
        )}
        {!isFullView && shownPartition && (
          <ToolGroup label={t("panels.doc.disassembly.origin")}>
            <select
              className={frame.select}
              value={disassOffset}
              title={t("panels.doc.disassembly.originTitle")}
              aria-label={t("panels.doc.disassembly.origin")}
              onChange={(e) => setDisassOffset(parseInt(e.target.value, 10))}
            >
              {Array.from({ length: 8 }, (_, i) => i * 0x2000).map((o) => (
                <option key={o} value={o}>
                  {decimalView ? o : `$${toHexa4(o)}`}
                </option>
              ))}
            </select>
          </ToolGroup>
        )}
        <span className={frame.spacer} />
        <ExportSourceButton scope={LIVE_VIEW_EXPORT_SCOPE} />
        <ReverseToolsMenu scope={LIVE_VIEW_EXPORT_SCOPE} />
        <Check label={t("panels.memoryView.inspector")} title={t("panels.memoryView.inspectorTitle")} value={inspectorShown} onChange={setInspectorShown} />
      </div>
      <HistoryPresentBanner subject="listedBytes" />

      {/* ─── The frame: map bar, partitions, registers (§4.2-4.4) ─────────────────── */}
      <div className={frame.frame}>
        <span className={frame.frameLabel}>
          {isFullView ? t("panels.memoryMap.view64k") : t("panels.memoryMap.viewPartition")}
        </span>
        {isFullView || !shownPartition ? (
          <MemoryMapBar
            cells={mapCells}
            viewport={
              items.length
                ? { start: pendingScrollTopAddress.current ?? 0, end: Math.min(0xffff, (pendingScrollTopAddress.current ?? 0) + 0x100) }
                : undefined
            }
            ticks={registers ? [{ name: "PC", address: registers.PC }, { name: "SP", address: registers.SP }] : undefined}
            onGoTo={(address) => goToTarget({ kind: "address", address })}
          />
        ) : (
          <PartitionBar
            partition={shownPartition}
            pagedAt={cpuAddressOf(slots, shownPartition.id, 0, shownPartition.size)}
            roles={partitionRoles?.[shownPartition.id]}
            labelOf={(id) => partitions.get(id)?.name}
          />
        )}
        {hasPartitions && (
          <>
            <span className={frame.frameLabel}>{t("panels.memoryMap.partitions")}</span>
            <PartitionRow
              set={partitionSet!}
              partitions={partitions}
              current={isFullView ? undefined : currentSegment}
              paged={paged}
              roles={partitionRoles}
              recent={recent}
              bankMapOpen={bankMapOpen}
              onBankMapOpenChange={setBankMapOpen}
              onSelect={(id) => void navigationHistoryService.recordJump("disassemblyGoTo", () => selectView(id))}
            />
          </>
        )}
        {registers && (
          <>
            <span className={frame.frameLabel}>{t("panels.memoryMap.registers")}</span>
            <RegisterStrip
              registers={registers}
              flags={refreshRegisters ? refreshRegisters.af & 0xff : undefined}
              decimal={decimalView}
              partitionLabelAt={(address) => mem64kLabels[address >> 13] || undefined}
              onGoTo={(_name, address) => goToTarget({ kind: "address", address })}
            />
          </>
        )}
      </div>

      <div className={classnames(frame.body, { [frame.bodyNoInspector]: !inspectorShown })}>
        <div className={frame.listing} ref={listRef}>
      {rows.length > 0 && (
        <div className={styles.disassemblyWrapper} onKeyDown={handleListKeyDown} tabIndex={-1}>
          <VirtualizedList
            items={rows}
            apiLoaded={(api) => (vlApi.current = api)}
            itemSize={disassemblyRowItemSize}
            revealUnmeasuredItems
            /* --- Long operands, labels and the bank/T-state columns overflow a narrow panel; see
               --- `MemoryPanel` for why the wrapper needs `max-content` for the bar to appear. */
            scrollRowsHorizontally
            onScroll={async () => {
              if (!vlApi.current) return;

              const startIndex = vlApi.current.findStartIndex();
              const item = rows[startIndex];
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
              const item = rows[idx];
              if (!item) return <div></div>;
              const flow = flowLayout?.rows.get(idx);
              const labelName = rowLabelName(item);
              const refCount = labelName ? (references.get(labelName)?.length ?? 0) : undefined;

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
                  instructionWidthCh={instructionWidthCh}
                  currentSegment={currentSegment}
                  decimalView={decimalView}
                  index={idx}
                  isFullView={isFullView}
                  item={item}
                  mem64kLabels={mem64kLabels}
                  onEditBreakpoint={editBreakpoint}
                  onRowMenu={openRowMenu}
                  onRowClick={selectAnnotationRow}
                  selected={item === annotationRow}
                  partitionLabels={machineSetup.partitionLabels}
                  partitionWidthCh={partitionWidthCh}
                  pausedPc={pausedPc}
                  historyBytes={history?.bytes}
                  rowHeight={disassemblyRowItemSize}
                  showBanks={machineSetup.showBanks}
                  showBranchGutter={showBranchGutter}
                  verdict={branchVerdicts?.get(item.address)}
                  showCoverage={!!coverageMarks}
                  coverage={coverageMarks?.get(item.address)}
                  timeShare={timeShares?.get(item.address)}
                  showFlow={!!flowLayout}
                  flow={flow}
                  flowHighlight={flow && highlighted ? highlighted : undefined}
                  flowTaken={flow ? takenEdge : undefined}
                  flowKey={flowKeyOf(idx)}
                  refCount={refCount}
                  onRefsClick={openReferences}
                />
              );
            }}
          />
        </div>
      )}
        </div>
        {/* --- The toggle always shows or hides the column; with no row selected it says how to fill it */}
        {inspectorShown && !annotationRow && <InspectorEmpty message={t("panels.disassInspector.noSelection")} />}
        {inspectorShown && annotationRow && (
          <DisassemblyInspector
            item={annotationRow}
            location={selectedLocation}
            kindBadge={selectedPartition ? `${selectedPartition.name} · ${kindText(t, selectedPartition.kind)}` : undefined}
            decimal={decimalView}
            verdict={branchVerdicts?.get(annotationRow.address)}
            atPc={annotationRow.address === pausedPc}
            operands={inspectedOperands}
            references={inspectedReferences}
            breakpointTarget={{
              address: annotationRow.address,
              spec: rowSpecOf(annotationRow),
              breakpoint: selectRowBreakpoint(
                breakpointMap.get(annotationRow.address),
                resolveRowPartition(annotationRow.address, isFullView, currentSegment, mem64kPartitions)
              ),
              item: annotationRow
            }}
            partitionLabels={machineSetup.partitionLabels}
            annotationEntries={annotationEditing.menuItemsFor(annotationRow)}
            onRunCommand={(command) => void ideCommandsService.executeCommand(command)}
            onEditBreakpoint={editBreakpoint}
            onAnnotationAction={(entry) => void annotationEditing.run(annotationRow, entry.id, entry.label)}
            onGoTo={(address) => goToTarget({ kind: "address", address })}
            onShowInMemory={showInMemory}
            onReference={(rowIndex) =>
              void navigationHistoryService.recordJump("disassemblyGoTo", () => revealRow(rowIndex))
            }
          />
        )}
      </div>
      <ContextMenu state={rowMenuState} onClickOutside={() => rowMenuApi.conceal()}>
        {rowMenuTarget &&
          annotationEditing.menuItemsFor(rowMenuTarget.item).map((entry, index) => (
            <span key={`${entry.id}:${index}`} style={{ display: "contents" }}>
              {entry.separatorBefore && <ContextMenuSeparator />}
              <ContextMenuItem
                text={entry.text}
                trailing={entry.hint}
                disabled={entry.disabled}
                clicked={() => {
                  rowMenuApi.conceal();
                  if (rowMenuTarget.item) {
                    void annotationEditing.run(rowMenuTarget.item, entry.id, entry.label);
                  }
                }}
              />
            </span>
          ))}
        {rowMenuTarget &&
          disassemblyRowMenuItems(rowMenuTarget, machineSetup.partitionLabels).map((item, index) => (
            <span key={item.id} style={{ display: "contents" }}>
              {(item.separatorBefore ||
                (index === 0 && annotationEditing.menuItemsFor(rowMenuTarget.item).length > 0)) && (
                <ContextMenuSeparator />
              )}
              <ContextMenuItem
                text={item.text}
                trailing={item.hint}
                disabled={item.disabled}
                clicked={() => {
                  rowMenuApi.conceal();
                  if (item.command) void ideCommandsService.executeCommand(item.command);
                  else if (item.id === "edit" && rowMenuTarget.breakpoint) {
                    editBreakpoint(rowMenuTarget.breakpoint);
                  }
                }}
              />
            </span>
          ))}
      </ContextMenu>
    </div>
  );
};

export const createBankedDisassemblyPanel = ({ document, contents }: DocumentProps) => (
  <BankedDisassemblyPanel document={document} contents={contents} apiLoaded={() => {}} />
);
