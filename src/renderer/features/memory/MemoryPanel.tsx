import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import classnames from "classnames";
import { charSetOfModel } from "@common/machines/info-types";
import { useRowSizes } from "@renderer/theming/useRowSizes";
import { derivePartitionWidthCh } from "@renderer/controls/data/partitionWidth";
import styles from "./MemoryPanel.module.scss";
import frame from "@renderer/features/memoryMap/MemoryMap.module.scss";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useDispatch, useSelector, useStore } from "@renderer/core/RendererProvider";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import type { VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import { HStack } from "@renderer/controls/layout/Panels";
import {
  incProjectFileVersionAction,
  setIdeStatusMessageAction,
  setMemoryHeatModeAction
} from "@common/state/actions";
import { hasMachineFeature } from "@common/features/advancedDebugging";
import { MF_PROFILE, MF_Z80, MI_ZXNEXT } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import type { ProfileView } from "@common/profile/profileTypes";
import { buildHeatSteps, heatTooltip, HEAT_MODES, type HeatMode } from "@renderer/features/coverage/heatModel";
import { useMainApi } from "@renderer/core/MainApi";
import { SetMemoryDialog, SetMemoryDialogResult } from "@renderer/appIde/dialogs/SetMemoryDialog";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { useT } from "@common/i18n/useT";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { isWritableKind } from "@common/annotations/partitionInfo";
import { parseFindPattern, findPattern, type FindPattern } from "@common/utils/memoryFind";
import type { MemoryFindMatch } from "@common/messaging/EmuApi";
import {
  CachedRefreshState,
  DumpViewMode,
  convertTopIndexForViewMode,
  createRowAddresses,
  getByteCount,
  getBytesPerRow,
  resolveViewMode
} from "./memoryViewModel";
import { useLoadedMemoryViewState, useMemoryViewStatePersistence } from "./useMemoryViewState";
import { useMemoryMachineSetup } from "./useMemoryMachineSetup";
import { useMemoryRefresh } from "./useMemoryRefresh";
import { getMemoryCharacterInfo, MemoryDumpSectionView } from "./MemoryDumpSection";
import { rowMarks } from "@renderer/features/memoryMap/byteMarks";
import { createVisibleMemoryRenderRecorder } from "./memoryPerformance";
import { MemoryInspector } from "./MemoryInspector";
import type { NavigationLocator } from "@renderer/abstractions/NavigationLocation";
import { HistoryPresentBanner } from "@renderer/appIde/debugger/history/HistoryPresentBanner";
import { useAddressSymbols } from "@renderer/appIde/annotations/useAddressSymbols";
import { Check, FindBox, GoToBox, Segmented, ToolGroup } from "@renderer/features/memoryMap/FrameControls";
import { MemoryMapBar, PartitionBar } from "@renderer/features/memoryMap/MemoryMapBar";
import { PartitionRow } from "@renderer/features/memoryMap/PartitionRow";
import { RegisterStrip } from "@renderer/features/memoryMap/RegisterStrip";
import { usePartitionInfo } from "@renderer/features/memoryMap/usePartitionInfo";
import { useNamedLocations } from "@renderer/features/memoryMap/useNamedLocations";
import { GO_TO_ERROR_KEYS, parseGoToTarget, suggestLabels, type GoToTarget } from "@renderer/features/memoryMap/goToTarget";
import {
  bankSiteOf,
  buildMapCells,
  cpuAddressOf,
  pagedSlotsOf,
  partitionAt,
  PRIMARY_REGISTERS,
  pushRecent,
  registerValuesOf,
  SECONDARY_REGISTERS
} from "@renderer/features/memoryMap/memoryMapModel";
import { kindText } from "@renderer/features/memoryMap/partitionText";
import { typeOverKey, valueBytes, writeMemoryEdit, type TypeOver } from "@renderer/features/memoryMap/memoryEdit";

/*
 * The Machine Memory document (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §5): the shared frame -
 * toolbar, memory map bar, partition row and Bank map, register strip, inspector column - around a
 * hex dump. The dump is the virtualised list it always was (`MemoryDumpSectionView`, one text node
 * per row with `ch`-positioned overlays); what is new is all overlays and chrome around it, so the
 * 64K dump keeps the scrolling budget of `memoryPerformance.ts`.
 *
 * M3: the row height comes from `rowSizes.ts`, not a private copy; see `useRowSizes`.
 */

/** The label gutter's width (§5.1) */
const LABEL_GUTTER_CH = 16;



const BankedMemoryPanel = ({ document }: DocumentProps) => {
  const t = useT();
  const { memory: memoryRowItemSize } = useRowSizes();
  const dispatch = useDispatch();
  const store = useStore();
  const documentHubService = useDocumentHubService();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const dialogs = useDialogs();
  const { ideCommandsService, machineService, navigationHistoryService, projectService } = useAppServices();
  const memoryCharacterInfo = getMemoryCharacterInfo(charSetOfModel(machineService.getMachineInfo()));

  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const machineId = useSelector((s) => s.emulatorState.machineId);
  const machineInfo = machineRegistry.find((m) => m.machineId === machineId);
  const isZ80 = !!machineInfo?.features?.[MF_Z80];
  const machineSetup = useMemoryMachineSetup(machineId, emuApi);
  const { set: partitionSet, partitions } = usePartitionInfo(emuApi);
  const allowRefresh = useRef(true);
  const emuViewVersion = useSelector((s) => s.emulatorState?.emuViewVersion);
  const loadedViewState = useLoadedMemoryViewState(documentHubService, document);

  // --- The heat map (`dev/plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D14)
  const storedHeatMode = useSelector((s) => s.ideView?.memoryHeatMode);
  const heatMode: HeatMode = HEAT_MODES.includes(storedHeatMode as HeatMode) ? (storedHeatMode as HeatMode) : "off";
  const heatAvailable = useSelector((s) =>
    hasMachineFeature(
      machineRegistry.find((m) => m.machineId === s.emulatorState?.machineId),
      MF_PROFILE,
      s
    )
  );
  const profileVersion = useSelector((s) => s.emulatorState?.profileVersion);
  const [heatView, setHeatView] = useState<ProfileView | undefined>();
  const heatViewRef = useRef<ProfileView | undefined>(undefined);
  heatViewRef.current = heatView;
  const heatTooltipOf = useCallback((address: number) => heatTooltip(heatViewRef.current, address), []);

  // --- View state (persisted)
  const [topIndex, setTopIndex] = useState<number>(() => loadedViewState?.topIndex ?? 0);
  const [isFullView, setIsFullView] = useState(() => loadedViewState?.isFullView ?? true);
  const [currentSegment, setCurrentSegment] = useState<number>(() => loadedViewState?.currentSegment ?? null);
  const [bankLabel] = useState(() => loadedViewState?.bankLabel ?? true);
  const [decimalView, setDecimalView] = useState(() => loadedViewState?.decimalView ?? false);
  const [viewMode, setViewMode] = useState<DumpViewMode>(() =>
    resolveViewMode(loadedViewState?.viewMode, loadedViewState?.twoColumns ?? true)
  );
  const [charDump, setCharDump] = useState(() => loadedViewState?.charDump ?? true);
  const [labelGutter, setLabelGutter] = useState(() => loadedViewState?.labelGutter ?? true);
  const [inspectorShown, setInspectorShown] = useState(() => loadedViewState?.inspector ?? true);
  const [follow, setFollow] = useState(() => loadedViewState?.follow ?? "");

  // --- View state (this session only)
  const [isReady, setIsReady] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const vlApi = useRef<VirtualizedListApi>(null);
  const [scrollVersion, setScrollVersion] = useState(1);
  const [lastJumpAddress, setLastJumpAddress] = useState<number>(-1);
  const [cursor, setCursor] = useState<number>(() => (loadedViewState?.topIndex ?? 0) * 16);
  const [anchor, setAnchor] = useState<number | undefined>();
  const [typeOver, setTypeOver] = useState<TypeOver | undefined>();
  const [recent, setRecent] = useState<number[]>([]);
  const [bankMapOpen, setBankMapOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [findScope, setFindScope] = useState<"view" | "all">("view");
  const [findResult, setFindResult] = useState<{ matches: MemoryFindMatch[]; length: number; truncated: boolean }>();
  const [findIndex, setFindIndex] = useState(0);
  const [findInvalid, setFindInvalid] = useState(false);
  const renderMetrics = useMemo(() => createVisibleMemoryRenderRecorder(), []);
  const pendingScrollTopIndex = useRef(topIndex);
  const listRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const bytesPerRow = getBytesPerRow(viewMode);
  const byteCount = getByteCount(viewMode);

  const cachedRefreshState = useRef<CachedRefreshState>({ isFullView, decimalView, currentSegment });
  const memoryRefresh = useMemoryRefresh({ allowRefresh, cachedRefreshState, emuApi, machineState });
  const memory = memoryRefresh.memory;
  const memoryItems = useMemo(
    () => createRowAddresses(memoryRefresh.memoryLength, bytesPerRow),
    [memoryRefresh.memoryLength, bytesPerRow]
  );

  const hasScrolledToInitialPosition = useRef(false);
  useEffect(() => {
    hasScrolledToInitialPosition.current = false;
    setHasScrolled(false);
  }, []);
  useEffect(() => {
    pendingScrollTopIndex.current = topIndex;
  }, [topIndex]);

  useEffect(() => {
    if (machineSetup.isInitializing || machineSetup.setupVersion === 0) return;
    setCurrentSegment((prev) => {
      const next = prev ?? machineSetup.defaultSegment;
      cachedRefreshState.current = { ...cachedRefreshState.current, currentSegment: next };
      return next;
    });
  }, [machineSetup.defaultSegment, machineSetup.isInitializing, machineSetup.setupVersion]);

  useMemoryViewStatePersistence({
    bankLabel,
    cachedRefreshState,
    charDump,
    currentSegment,
    decimalView,
    documentId: document.id,
    dispatch,
    documentHubService,
    incProjectFileVersion: incProjectFileVersionAction,
    isFullView,
    isInitializing: machineSetup.isInitializing,
    mainApi,
    topIndex,
    viewMode,
    labelGutter,
    inspector: inspectorShown,
    follow
  });

  // --- Initial view: wait for machine setup, refresh memory, then mark as ready
  useEffect(() => {
    if (machineSetup.isInitializing || machineSetup.setupVersion === 0) return undefined;
    let cancelled = false;
    void (async () => {
      const nextSegment = currentSegment ?? machineSetup.defaultSegment;
      cachedRefreshState.current = { isFullView, decimalView, currentSegment: nextSegment };
      if (currentSegment === null) setCurrentSegment(nextSegment);
      await memoryRefresh.refreshMemoryView();
      if (!cancelled) setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineSetup.setupVersion]);

  // --- Programmatic scrolls (a jump), not user scrolls
  const lastScrolledIndex = useRef(-1);
  useEffect(() => {
    if (!vlApi.current || scrollVersion === 1) return;
    const scrollIndex = Math.floor(topIndex);
    if (scrollIndex !== lastScrolledIndex.current) {
      lastScrolledIndex.current = scrollIndex;
      vlApi.current.scrollToIndex(scrollIndex, { align: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollVersion]);

  useEffect(() => {
    if (machineState === MachineControllerState.Paused || machineState === MachineControllerState.Stopped) {
      void memoryRefresh.refreshMemoryView();
    }
  }, [machineState, memoryRefresh.refreshMemoryView]);

  useEffect(() => {
    if (machineSetup.isInitializing) return;
    void memoryRefresh.refreshMemoryView();
  }, [currentSegment, isFullView, decimalView, emuViewVersion, machineSetup.isInitializing, memoryRefresh.refreshMemoryView]);

  // --- The heat map's data follows the profile, the view and the memory refresh
  useEffect(() => {
    if (!heatAvailable || heatMode === "off" || machineSetup.isInitializing) {
      setHeatView(undefined);
      return undefined;
    }
    let cancelled = false;
    void emuApi
      .getProfileView(isFullView ? undefined : (currentSegment ?? undefined), true)
      .then((view) => !cancelled && setHeatView(view))
      .catch(() => !cancelled && setHeatView(undefined));
    return () => {
      cancelled = true;
    };
  }, [emuApi, heatAvailable, heatMode, profileVersion, isFullView, currentSegment, memoryRefresh.memoryVersion, machineSetup.isInitializing]);
  const heatSteps = useMemo(() => buildHeatSteps(heatView, heatMode), [heatView, heatMode]);
  const handleHeatModeChanged = useCallback((mode: HeatMode) => dispatch(setMemoryHeatModeAction(mode)), [dispatch]);

  const handleEmuStateChange = useCallback(() => {
    if (!allowRefresh.current) return Promise.resolve();
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

  // ─── Where things are ──────────────────────────────────────────────────────────────────────────

  const slotPartitions = memoryRefresh.slotPartitions;
  const shownPartition = !isFullView ? partitions.get(currentSegment) : undefined;
  const mapCells = useMemo(
    () => buildMapCells(slotPartitions, partitions, machineSetup.romFlags),
    [slotPartitions, partitions, machineSetup.romFlags]
  );
  const paged = useMemo(() => pagedSlotsOf(slotPartitions), [slotPartitions]);
  const registers = useMemo(
    () => (memoryRefresh.registers ? registerValuesOf(memoryRefresh.registers) : undefined),
    [memoryRefresh.registers]
  );
  const partitionLabelOf = useCallback((id: number) => partitions.get(id)?.name, [partitions]);

  /** The partition and offset a view address shows */
  const locate = useCallback(
    (address: number) => {
      if (!isFullView) {
        const p = partitions.get(currentSegment);
        return p ? { partition: p, offset: address } : undefined;
      }
      const at = partitionAt(slotPartitions, partitions, address);
      const p = at ? partitions.get(at.partition) : undefined;
      return p && at ? { partition: p, offset: at.offset } : undefined;
    },
    [isFullView, partitions, currentSegment, slotPartitions]
  );

  /** Where the CPU sees a view address now */
  const cpuAddressOfView = useCallback(
    (address: number) => {
      if (isFullView) return address;
      const p = partitions.get(currentSegment);
      return p ? cpuAddressOf(slotPartitions, p.id, address, p.size) : undefined;
    },
    [isFullView, partitions, currentSegment, slotPartitions]
  );

  // --- The labels: the shared resolver, asked with the paging the view shows
  const { symbols, bankSpace } = useAddressSymbols(projectService, { romLabels: true });
  const namedLocations = useNamedLocations(symbols);
  const labelSlots = useMemo(() => {
    if (isFullView) return slotPartitions;
    // --- A partition on its own is named as if paged in from $0000
    const size = shownPartition?.size ?? 0x4000;
    const slots: (number | undefined)[] = Array(8).fill(undefined);
    for (let s = 0; s < size / 0x2000; s++) slots[s] = currentSegment;
    return slots;
  }, [isFullView, slotPartitions, shownPartition, currentSegment]);
  const labelAt = useCallback(
    (address: number) => (symbols.empty ? undefined : symbols.labelAt(address, labelSlots)),
    [symbols, labelSlots]
  );

  // --- The registers pointing at each view address
  const pointedInView = useMemo(() => {
    if (isFullView) return memoryRefresh.pointedRegs;
    const result: Record<number, string> = {};
    const p = shownPartition;
    if (!p) return result;
    for (const [address, names] of Object.entries(memoryRefresh.pointedRegs)) {
      const at = partitionAt(slotPartitions, partitions, Number(address));
      if (at && at.partition === p.id) result[at.offset] = names;
    }
    return result;
  }, [isFullView, memoryRefresh.pointedRegs, shownPartition, slotPartitions, partitions]);

  // --- Changed since the previous stop
  const baseline = memoryRefresh.baseline;
  const changedPartitions = useMemo(() => {
    const set = new Set<number>();
    if (!baseline || baseline.length !== memory.length) return set;
    for (let a = 0; a < memory.length; a++) {
      if (memory[a] !== baseline[a]) {
        const at = locate(a);
        if (at) set.add(at.partition.id);
        a |= 0x1fff;
      }
    }
    return set;
  }, [baseline, memory, locate]);

  // --- Memory breakpoints' bytes in the view
  const breakpointBytes = useMemo(() => {
    const marks = new Set<number>();
    for (const bp of memoryRefresh.memBreakpoints) {
      if (bp.address === undefined || (!bp.memoryRead && !bp.memoryWrite)) continue;
      const length = Math.max(1, bp.length ?? 1);
      for (let i = 0; i < length && i < 0x10000; i++) {
        const cpu = (bp.address + i) & 0xffff;
        if (isFullView) {
          if (bp.partition === undefined || slotPartitions?.[cpu >> 13] === bp.partition) marks.add(cpu);
        } else if (bp.partition === currentSegment) {
          const at = partitionAt(slotPartitions, partitions, cpu);
          marks.add(at?.partition === currentSegment ? at.offset : cpu % (shownPartition?.size ?? 0x4000));
        }
      }
    }
    return marks;
  }, [memoryRefresh.memBreakpoints, isFullView, slotPartitions, currentSegment, partitions, shownPartition]);

  // --- The find matches as view addresses
  const findLength = findResult?.length ?? 0;
  const viewMatches = useMemo(() => {
    if (!findResult) return [] as number[];
    const out: number[] = [];
    for (const m of findResult.matches) {
      if (m.partition === undefined) out.push(m.offset);
      else if (!isFullView && m.partition === currentSegment) out.push(m.offset);
      else if (isFullView) {
        const p = partitions.get(m.partition);
        const cpu = p ? cpuAddressOf(slotPartitions, p.id, m.offset, p.size) : undefined;
        if (cpu !== undefined) out.push(cpu);
      }
    }
    return out;
  }, [findResult, isFullView, currentSegment, partitions, slotPartitions]);

  // ─── Going places ──────────────────────────────────────────────────────────────────────────────

  const handleViewModeChanged = useCallback(
    (newMode: DumpViewMode) => {
      setTopIndex(convertTopIndexForViewMode(topIndex, viewMode, newMode));
      setViewMode(newMode);
      setScrollVersion((version) => version + 1);
    },
    [topIndex, viewMode]
  );

  const visibleRowCount = () => Math.max(1, Math.floor((vlApi.current?.viewportSize ?? 400) / memoryRowItemSize));

  /** Scroll so an address is in view; with `top`, to the top row */
  const revealAddress = useCallback(
    (address: number, top = false) => {
      const row = Math.floor(address / bytesPerRow);
      const start = vlApi.current?.findStartIndex() ?? pendingScrollTopIndex.current;
      const rows = Math.max(1, Math.floor((vlApi.current?.viewportSize ?? 400) / memoryRowItemSize));
      if (!top && row >= start && row < start + rows - 1) return;
      const next = top ? row : row < start ? row : Math.max(0, row - rows + 2);
      setTopIndex(next);
      setScrollVersion((version) => version + 1);
    },
    [bytesPerRow, memoryRowItemSize]
  );

  const handleGoToAddress = useCallback(
    (address: number) => {
      setLastJumpAddress(address);
      setCursor(address);
      setAnchor(undefined);
      setTopIndex(Math.floor(address / bytesPerRow));
      setScrollVersion((version) => version + 1);
    },
    [bytesPerRow]
  );

  /*
   * Navigation history (Go Back / Go Forward): the view's place is kept in refs updated
   * synchronously, so the history reads where the view is just before and just after a jump
   * (`dev/plans/NAVIGATION_HISTORY_PLAN.md` §4.2).
   */
  const navAddress = useRef(topIndex * bytesPerRow);
  const navSegment = useRef(currentSegment);
  const navFullView = useRef(isFullView);
  const navBytesPerRow = useRef(bytesPerRow);
  navSegment.current = currentSegment;
  navFullView.current = isFullView;
  navBytesPerRow.current = bytesPerRow;

  /** Show the 64K, or one partition on its own; the recent list remembers the partitions */
  const selectView = useCallback(
    (partition: number | undefined) => {
      if (partition === undefined) {
        navFullView.current = true;
        setIsFullView(true);
      } else {
        navFullView.current = false;
        navSegment.current = partition;
        setIsFullView(false);
        setCurrentSegment(partition);
        setRecent((r) => pushRecent(r, partition));
      }
      setTopIndex(0);
      setCursor(0);
      setAnchor(undefined);
      setScrollVersion((v) => v + 1);
    },
    []
  );

  const goToTarget = useCallback(
    (target: GoToTarget) =>
      void navigationHistoryService.recordJump("memoryGoTo", () => {
        if (target.kind === "address") {
          // --- A number stays in the view (an offset of the partition shown); a register or a
          // --- label names a CPU address, which the 64K view shows
          if (!isFullView && target.via !== "number") {
            navFullView.current = true;
            setIsFullView(true);
          }
          navAddress.current = target.address;
          handleGoToAddress(target.address);
        } else {
          if (isFullView || currentSegment !== target.partition) {
            navFullView.current = false;
            navSegment.current = target.partition;
            setIsFullView(false);
            setCurrentSegment(target.partition);
            setRecent((r) => pushRecent(r, target.partition));
          }
          navAddress.current = target.offset;
          handleGoToAddress(target.offset);
        }
      }),
    [navigationHistoryService, isFullView, currentSegment, handleGoToAddress]
  );

  const goToAddressRecorded = useCallback(
    (address: number) => goToTarget({ kind: "address", address }),
    [goToTarget]
  );

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
    navAddress.current = locator.address;
    handleGoToAddress(locator.address);
  };

  useEffect(() => {
    documentHubService.setDocumentApi(document.id, {
      getNavigationLocator: () => ({
        kind: "address",
        address: navAddress.current,
        segment: navSegment.current,
        fullView: navFullView.current,
        viewMode: "memory"
      }),
      revealLocator: (locator) => revealLocator.current(locator)
    });
    return () => documentHubService.setDocumentApi(document.id, undefined);
  }, [document.id, documentHubService]);

  // --- Follow a register: the cursor goes where it points at every refresh
  const followValue = follow && registers ? registers[follow] : undefined;
  useEffect(() => {
    if (followValue === undefined) return;
    if (!isFullView) {
      navFullView.current = true;
      setIsFullView(true);
    }
    setCursor(followValue);
    setAnchor(undefined);
    revealAddress(followValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followValue]);

  // ─── Editing ───────────────────────────────────────────────────────────────────────────────────

  const readOnlyReason = useCallback(
    (address: number): string | undefined => {
      const at = locate(address);
      if (at) {
        return isWritableKind(at.partition.kind)
          ? undefined
          : t("panels.memoryInspector.readOnlyKind", { kind: kindText(t, at.partition.kind) });
      }
      if (isFullView && machineSetup.romFlags?.[(address >> 13) & 0x07]) {
        return t("panels.memoryInspector.readOnlyKind", { kind: kindText(t, "rom") });
      }
      return undefined;
    },
    [locate, isFullView, machineSetup.romFlags, t]
  );

  const writeBytes = useCallback(
    async (address: number, bytes: number[]) => {
      const written = await writeMemoryEdit(
        { store, emuApi, mainApi },
        address,
        bytes,
        isFullView ? undefined : currentSegment
      );
      if (written) await memoryRefresh.refreshMemoryView();
      return written;
    },
    [store, emuApi, mainApi, isFullView, currentSegment, memoryRefresh]
  );

  /** The context menu's dialog: multi-byte values (D3) */
  const editMemoryContent = useCallback(
    (address: number) => {
      const isRom = !!readOnlyReason(address);
      const currentValue = memory[address];
      void (async () => {
        const result = await dialogs.open<SetMemoryDialogResult>((controls) => (
          <SetMemoryDialog
            address={address}
            currentValue={currentValue}
            decimal={decimalView}
            isRom={isRom}
            onSetMemory={(r) => controls.close(r)}
            onClose={() => controls.cancel()}
          />
        ));
        if (!result) return;
        if (isFullView) {
          const command = `setmem ${address} ${result.value.replace(" ", "")} ${result.sizeOption} ${
            result.bigEndian ? "-be" : ""
          }`;
          await ideCommandsService.executeCommand(command);
          return;
        }
        // --- A partition on its own: `setmem` names only the 64K, so the bytes go to the partition
        const value = parseInt(result.value.replace(/[\s$]/g, ""), decimalView ? 10 : 16);
        const size = result.sizeOption === "-b32" ? 4 : result.sizeOption === "-b16" ? 2 : 1;
        if (!Number.isNaN(value)) await writeBytes(address, valueBytes(value, size, result.bigEndian));
      })();
    },
    [decimalView, dialogs, ideCommandsService, isFullView, memory, readOnlyReason, writeBytes]
  );

  // ─── Find ──────────────────────────────────────────────────────────────────────────────────────

  const showMatch = useCallback(
    (match: MemoryFindMatch | undefined) => {
      if (!match) return;
      if (match.partition === undefined) {
        goToTarget({ kind: "address", address: match.offset });
        return;
      }
      // --- A match in the view keeps the view; elsewhere its partition opens
      if (!isFullView && match.partition === currentSegment) {
        goToTarget({ kind: "partition", partition: match.partition, offset: match.offset });
        return;
      }
      const p = partitions.get(match.partition);
      const cpu = isFullView && p ? cpuAddressOf(slotPartitions, p.id, match.offset, p.size) : undefined;
      if (cpu !== undefined) goToTarget({ kind: "address", address: cpu });
      else goToTarget({ kind: "partition", partition: match.partition, offset: match.offset });
    },
    [goToTarget, isFullView, currentSegment, partitions, slotPartitions]
  );

  const runFind = useCallback(async () => {
    const text = findText.trim();
    if (!text) return;
    const pattern: FindPattern | undefined = parseFindPattern(text, decimalView);
    if (!pattern) {
      // --- Not bytes or text: a label's name
      const target = parseGoToTarget(text, { labels: namedLocations, slotPartitions, partitionSize: (id) => partitions.get(id)?.size });
      if ("target" in target && target.target.via === "label") {
        setFindInvalid(false);
        setFindResult({ matches: [], length: 0, truncated: false });
        goToTarget(target.target);
        return;
      }
      setFindInvalid(true);
      return;
    }
    setFindInvalid(false);
    if (findScope === "all" && partitionSet) {
      const result = await emuApi.findMemory(pattern, "partitions");
      setFindResult({ ...result, length: pattern.length });
      setFindIndex(0);
      showMatch(result.matches[0]);
      return;
    }
    const { offsets, truncated } = findPattern(memory, pattern, 5000);
    const matches = offsets.map((offset) => ({ offset, ...(isFullView ? {} : { partition: currentSegment }) }));
    // --- The first match at or after the cursor
    const first = Math.max(0, offsets.findIndex((o) => o >= cursor));
    setFindResult({ matches, length: pattern.length, truncated });
    setFindIndex(first);
    showMatch(matches[first]);
  }, [findText, decimalView, findScope, partitionSet, emuApi, memory, isFullView, currentSegment, cursor, namedLocations, slotPartitions, partitions, goToTarget, showMatch]);

  const stepFind = useCallback(
    (delta: 1 | -1) => {
      if (!findResult?.matches.length) return;
      const n = findResult.matches.length;
      const next = (findIndex + delta + n) % n;
      setFindIndex(next);
      showMatch(findResult.matches[next]);
    },
    [findResult, findIndex, showMatch]
  );

  // ─── Cursor, selection, keyboard ───────────────────────────────────────────────────────────────

  const memoryLength = memoryRefresh.memoryLength;
  const moveCursor = useCallback(
    (to: number, extend: boolean) => {
      const next = Math.max(0, Math.min(memoryLength - 1, to));
      if (extend) setAnchor((a) => (a === undefined ? cursor : a));
      else setAnchor(undefined);
      setCursor(next);
      setTypeOver(undefined);
      revealAddress(next);
    },
    [memoryLength, cursor, revealAddress]
  );

  const handleBytePointer = useCallback(
    (address: number, kind: "down" | "drag", extend: boolean) => {
      listRef.current?.focus({ preventScroll: true });
      setTypeOver(undefined);
      if (kind === "down" && !extend) {
        setAnchor(undefined);
        setCursor(address);
        setFollow("");
        return;
      }
      setAnchor((a) => (a === undefined ? cursor : a));
      setCursor(address);
    },
    [cursor]
  );

  const selection: [number, number] | undefined =
    anchor !== undefined && anchor !== cursor ? [Math.min(anchor, cursor), Math.max(anchor, cursor)] : undefined;

  const onListKeyDown = async (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      if (partitionSet && partitionSet.partitions.length > 16) setBankMapOpen((o) => !o);
      return;
    }
    if (ctrl && (e.key === "g" || e.key === "G" || e.key === "f" || e.key === "F")) {
      e.preventDefault();
      const inputs = toolbarRef.current?.querySelectorAll("input");
      (inputs?.[e.key.toLowerCase() === "g" ? 0 : 1] as HTMLInputElement | undefined)?.focus();
      return;
    }
    if (e.key === "F3") {
      e.preventDefault();
      stepFind(e.shiftKey ? -1 : 1);
      return;
    }
    const rows = visibleRowCount();
    const moves: Record<string, number> = {
      ArrowLeft: cursor - 1,
      ArrowRight: cursor + 1,
      ArrowUp: cursor - bytesPerRow,
      ArrowDown: cursor + bytesPerRow,
      PageUp: cursor - bytesPerRow * rows,
      PageDown: cursor + bytesPerRow * rows,
      Home: ctrl ? 0 : cursor - (cursor % bytesPerRow),
      End: ctrl ? memoryLength - 1 : cursor - (cursor % bytesPerRow) + bytesPerRow - 1
    };
    if (e.key in moves) {
      e.preventDefault();
      e.stopPropagation();
      moveCursor(moves[e.key], e.shiftKey);
      return;
    }
    if (e.key === "Escape" && !typeOver) {
      setAnchor(undefined);
      return;
    }
    // --- Type-over (§5.3, D3): only where the byte can be written
    if (ctrl || e.altKey) return;
    if (readOnlyReason(cursor)) return;
    const step = typeOverKey(typeOver, e.key, decimalView);
    if (!step) return;
    e.preventDefault();
    // --- The emulated keyboard listens on `window` while a machine runs
    e.stopPropagation();
    setTypeOver(step.state);
    if (step.commit !== undefined) {
      const at = cursor;
      const written = await writeBytes(at, [step.commit]);
      if (written && at + 1 < memoryLength) {
        setCursor(at + 1);
        revealAddress(at + 1);
      }
    }
  };

  // ─── Layout ────────────────────────────────────────────────────────────────────────────────────

  const showPartitionColumn = bankLabel && isFullView && machineSetup.banksView;
  const partitionWidthCh = useMemo(
    () =>
      derivePartitionWidthCh({
        candidateLabels: memoryRefresh.mem64kLabels,
        decimalView,
        enabled: showPartitionColumn
      }),
    [showPartitionColumn, decimalView, memoryRefresh.mem64kLabels]
  );

  // --- The rows where the 64K enters another slot's partition get a rule
  const slotBoundaries = useMemo(
    () => new Set(isFullView ? mapCells.slice(1).map((c) => c.start) : []),
    [isFullView, mapCells]
  );

  // --- The heat strip in the map bar: one flag per 1K
  const heatStrip = useMemo(() => {
    if (!heatSteps || !isFullView) return undefined;
    const strip: boolean[] = [];
    for (let k = 0; k < 64; k++) {
      let hot = false;
      for (let a = k * 0x400; a < (k + 1) * 0x400 && !hot; a++) hot = !!heatSteps[a];
      strip.push(hot);
    }
    return strip;
  }, [heatSteps, isFullView]);

  const viewport = {
    start: topIndex * bytesPerRow,
    end: Math.min(memoryLength - 1, (topIndex + visibleRowCount()) * bytesPerRow - 1)
  };

  // --- Partition labels for every row in the 64K view
  const rowPartitionLabel = (address: number) =>
    isFullView ? memoryRefresh.mem64kLabels[address >> 13] : machineSetup.partitionLabels?.[currentSegment];

  // --- The cursor's facts, for the inspector
  const cursorLocation = locate(cursor);
  const cursorCpu = cpuAddressOfView(cursor);
  const cursorLabel = cursorCpu !== undefined || !isFullView ? labelAt(cursor) : undefined;
  const wordAtCursor = (memory[cursor] ?? 0) | ((memory[cursor + 1] ?? 0) << 8);
  const wordLabel = symbols.empty || !isFullView ? undefined : symbols.labelAt(wordAtCursor, slotPartitions)?.name;
  const z80n = machineId === MI_ZXNEXT;

  const goToText = useCallback(
    (text: string): string | undefined => {
      const result = parseGoToTarget(text, {
        decimal: decimalView,
        registers,
        partitionLabels: machineSetup.partitionLabels,
        partitionSize: (id) => partitions.get(id)?.size,
        slotPartitions,
        labels: namedLocations
      });
      if ("error" in result) {
        return result.error === "empty" ? undefined : t(GO_TO_ERROR_KEYS[result.error]);
      }
      if (result.target.kind === "partition") {
        const size = partitions.get(result.target.partition)?.size;
        if (size === undefined && !machineSetup.partitionLabels?.[result.target.partition]) {
          return t("panels.memoryMap.goToError.partition");
        }
      }
      goToTarget(result.target);
      return undefined;
    },
    [decimalView, registers, machineSetup.partitionLabels, partitions, slotPartitions, namedLocations, goToTarget, t]
  );

  /** The inspector's breakpoints: at the cursor, or a write breakpoint over the selection */
  /*
   * The inspector's breakpoints: at the cursor, or a write breakpoint over the selection. A byte of
   * a RAM bank is named bank-relatively (`bp-set 05:+$0010`), which fires wherever the bank is paged
   * and so works for a bank shown on its own, paged in or not; anything else (ROM, a DivMMC page, a
   * machine without banks) by its CPU address, qualified by its partition where there is one. What
   * `bp-set` says when it refuses goes to the status bar: a button that silently did nothing is the
   * failure this replaced.
   */
  const setBreakpoint = (kind: "exec" | "write") => {
    const from = selection ? selection[0] : cursor;
    const length = selection ? selection[1] - selection[0] + 1 : 1;
    const at = locate(from);
    const site = at ? bankSiteOf(bankSpace, at.partition, at.offset) : undefined;
    let spec: string;
    if (site) {
      spec = `${toHexa2(site.bank)}:+$${toHexa4(site.offset)}`;
    } else {
      const cpu = cpuAddressOfView(from);
      if (cpu === undefined) {
        dispatch(setIdeStatusMessageAction(t("panels.memoryInspector.notPagedForBreakpoint"), false));
        return;
      }
      spec = at && partitionSet ? `${at.partition.name}:$${toHexa4(cpu)}` : `$${toHexa4(cpu)}`;
    }
    const options = kind === "write" ? ` -w${length > 1 ? ` -len ${length}` : ""}` : "";
    void ideCommandsService.executeCommand(`bp-set ${spec}${options}`).then((result) => {
      if (result && !result.success && result.finalMessage) {
        dispatch(setIdeStatusMessageAction(result.finalMessage, false));
      }
    });
  };

  const openInDisassembly = () => {
    const at = locate(cursor);
    const target =
      cursorCpu !== undefined && isFullView
        ? `$${toHexa4(cursorCpu)}`
        : at && partitionSet
          ? `${at.partition.name}:$${toHexa4(at.offset)}`
          : `$${toHexa4(cursor)}`;
    void navigationHistoryService.recordJump("memoryGoTo", () =>
      ideCommandsService.executeCommand(`show-disass ${target}`)
    );
  };

  if (!isReady) return null;

  const shouldHideUntilScrolled = topIndex > 0 && !hasScrolled;
  const hasPartitions = !!partitionSet && partitionSet.partitions.length > 0;
  const followOptions = registers ? [...PRIMARY_REGISTERS, ...SECONDARY_REGISTERS] : [];
  const columnsText = Array.from({ length: bytesPerRow }, (_, i) =>
    decimalView ? `+${i}`.padEnd(3) : `+${i.toString(16).toUpperCase()}`
  ).join(" ");

  return (
    <div className={frame.document} style={{ opacity: shouldHideUntilScrolled ? 0 : 1 }}>
      {/* ─── Toolbar (§4.1) ─────────────────────────────────────────────────────────── */}
      <div className={frame.toolbar} ref={toolbarRef}>
        <GoToBox
          placeholder={t("panels.memoryMap.goToPlaceholder")}
          title={t("panels.memoryMap.goToTitle")}
          suggestions={(text) => suggestLabels(text, namedLocations)}
          onGo={goToText}
          onFocusChange={handleRefreshPauseChanged}
        />
        <FindBox
          placeholder={t("panels.memoryView.findPlaceholder")}
          title={t("panels.memoryView.findTitle")}
          text={findText}
          count={findResult ? findResult.matches.length : undefined}
          index={findIndex}
          invalid={findInvalid}
          onTextChange={(text) => {
            setFindText(text);
            setFindResult(undefined);
            setFindInvalid(false);
          }}
          onSearch={() => void runFind()}
          onStep={stepFind}
          trailing={
            hasPartitions ? (
              <Segmented
                label={t("panels.memoryView.findScope")}
                value={findScope}
                options={[
                  { value: "view", text: t("panels.memoryView.findScopeView"), title: t("panels.memoryView.findScopeViewTitle") },
                  { value: "all", text: t("panels.memoryView.findScopeAll"), title: t("panels.memoryView.findScopeAllTitle") }
                ]}
                onChange={(v) => {
                  setFindScope(v);
                  setFindResult(undefined);
                }}
              />
            ) : undefined
          }
        />
        <ToolGroup label={t("panels.memoryView.bytes")}>
          <Segmented
            label={t("panels.memoryView.bytes")}
            value={viewMode}
            options={[
              { value: "8x1", text: "8" },
              { value: "16x1", text: "16" },
              { value: "32x1", text: "32" }
            ]}
            onChange={handleViewModeChanged}
          />
        </ToolGroup>
        <Segmented
          label={t("panels.memoryView.numberFormat")}
          value={decimalView ? "dec" : "hex"}
          options={[
            { value: "hex", text: t("panels.memoryView.hex"), title: t("panels.memoryView.hexTitle") },
            { value: "dec", text: t("panels.memoryView.dec"), title: t("panels.feature.memory.decimalTooltip") }
          ]}
          onChange={(v) => setDecimalView(v === "dec")}
        />
        <Check
          label={t("panels.feature.memory.chars")}
          title={t("panels.feature.memory.charsTooltip")}
          value={charDump}
          onChange={setCharDump}
        />
        <Check
          label={t("panels.memoryView.labels")}
          title={t("panels.memoryView.labelsTitle")}
          value={labelGutter}
          onChange={setLabelGutter}
        />
        {heatAvailable && (
          <ToolGroup label={t("panels.feature.memory.heat")}>
            <Segmented
              label={t("panels.feature.memory.heatMap")}
              value={heatMode}
              options={[
                { value: "off", text: t("panels.feature.memory.heat.off") },
                { value: "exec", text: t("panels.feature.memory.heat.executed") },
                { value: "read", text: t("panels.feature.memory.heat.read") },
                { value: "write", text: t("panels.feature.memory.heat.written") },
                { value: "all", text: t("panels.feature.memory.heat.all") }
              ]}
              onChange={(v) => handleHeatModeChanged(v as HeatMode)}
            />
          </ToolGroup>
        )}
        <span className={frame.spacer} />
        {registers && (
          <ToolGroup label={t("panels.memoryView.follow")}>
            <select
              className={frame.select}
              value={follow}
              title={t("panels.memoryView.followTitle")}
              aria-label={t("panels.memoryView.follow")}
              onChange={(e) => {
                setFollow(e.target.value);
                if (e.target.value && !isFullView) selectView(undefined);
              }}
            >
              <option value="">—</option>
              {followOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </ToolGroup>
        )}
        <Check
          label={t("panels.memoryView.inspector")}
          title={t("panels.memoryView.inspectorTitle")}
          value={inspectorShown}
          onChange={setInspectorShown}
        />
      </div>
      <HistoryPresentBanner />

      {/* ─── The frame: map bar, partitions, registers (§4.2-4.4) ─────────────────── */}
      <div className={frame.frame}>
        <span className={frame.frameLabel}>
          {isFullView ? t("panels.memoryMap.view64k") : t("panels.memoryMap.viewPartition")}
        </span>
        {isFullView || !shownPartition ? (
          <MemoryMapBar
            cells={mapCells}
            viewport={viewport}
            ticks={registers ? [{ name: "PC", address: registers.PC }, { name: "SP", address: registers.SP }] : undefined}
            heat={heatStrip}
            onGoTo={(address) => (isFullView ? goToAddressRecorded(address) : goToTarget({ kind: "address", address }))}
          />
        ) : (
          <PartitionBar
            partition={shownPartition}
            pagedAt={cpuAddressOf(slotPartitions, shownPartition.id, 0, shownPartition.size)}
            roles={memoryRefresh.partitionRoles?.[shownPartition.id]}
            viewport={viewport}
            labelOf={partitionLabelOf}
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
              roles={memoryRefresh.partitionRoles}
              recent={recent}
              changed={changedPartitions}
              bankMapOpen={bankMapOpen}
              onBankMapOpenChange={setBankMapOpen}
              onSelect={(id) =>
                void navigationHistoryService.recordJump("memoryGoTo", () => selectView(id))
              }
            />
          </>
        )}
        {registers && (
          <>
            <span className={frame.frameLabel}>{t("panels.memoryMap.registers")}</span>
            <RegisterStrip
              registers={registers}
              followed={follow}
              decimal={decimalView}
              partitionLabelAt={(address) => memoryRefresh.mem64kLabels[address >> 13] || undefined}
              onGoTo={(_name, address) => goToTarget({ kind: "address", address })}
            />
          </>
        )}
      </div>

      {/* ─── The dump and the inspector ────────────────────────────────────────────── */}
      <div className={classnames(frame.body, { [frame.bodyNoInspector]: !inspectorShown })}>
        <div
          className={frame.listing}
          ref={listRef}
          tabIndex={0}
          role="grid"
          aria-label={t("panels.memoryView.dump")}
          onKeyDown={(e) => void onListKeyDown(e)}
          style={{ outline: "none" }}
        >
          <div className={styles.columnHeads} aria-hidden>
            {labelGutter && <span style={{ width: `${LABEL_GUTTER_CH}ch` }}>{t("panels.memoryView.labelColumn")}</span>}
            <span style={{ width: `calc(${8 + partitionWidthCh + (decimalView ? 8 : 7)}ch + 8px)` }}>
              {showPartitionColumn ? t("panels.memoryView.partAddr") : t("panels.memoryView.addr")}
            </span>
            <span className={styles.columnBytes}>{columnsText}</span>
          </div>
          <VirtualizedList
            items={memoryItems}
            itemSize={memoryRowItemSize}
            revealUnmeasuredItems
            scrollRowsHorizontally
            startIndex={topIndex}
            onScroll={() => {
              if (!vlApi.current || memoryItems.length === 0) return;
              pendingScrollTopIndex.current = vlApi.current.findStartIndex();
            }}
            onScrollEnd={() => {
              const newTopIndex = pendingScrollTopIndex.current;
              if (Math.floor(navAddress.current / navBytesPerRow.current) !== newTopIndex) {
                navAddress.current = newTopIndex * navBytesPerRow.current;
              }
              setTopIndex((current) => (newTopIndex === current ? current : newTopIndex));
            }}
            apiLoaded={(api) => {
              vlApi.current = api;
              lastScrolledIndex.current = -1;
              if (!hasScrolledToInitialPosition.current && topIndex > 0) {
                setTimeout(() => {
                  hasScrolledToInitialPosition.current = true;
                  setHasScrolled(true);
                }, 50);
              } else {
                hasScrolledToInitialPosition.current = true;
                setHasScrolled(true);
              }
            }}
            renderItem={(idx) => {
              renderMetrics.recordRow(1);
              const address = memoryItems[idx];
              const isRom = isFullView
                ? !!machineSetup.romFlags?.[(address >> 13) & 0x07]
                : !!shownPartition && !isWritableKind(shownPartition.kind);
              const bytes = memory.subarray(address, address + byteCount);
              const heat = heatSteps?.subarray(address, address + byteCount);
              const marks = rowMarks(address, byteCount, {
                cursor,
                selection,
                typeOver,
                matches: viewMatches,
                findLength,
                currentMatch: findResult ? viewMatches[findIndex] : undefined,
                breakpointBytes,
                baseline,
                bytes: memory
              });
              // --- The label gutter: the row's first label and the registers pointing into it
              let gutterLabel: string | undefined;
              const tags: string[] = [];
              if (labelGutter) {
                for (let i = 0; i < byteCount; i++) {
                  if (!gutterLabel) gutterLabel = labelAt(address + i)?.name;
                  const pointed = pointedInView[address + i];
                  if (pointed) for (const name of pointed.split(", ")) if (!tags.includes(name)) tags.push(name);
                }
              }
              return (
                <HStack
                  backgroundColor={idx % 2 === 0 ? "--bgcolor-disass-even-row" : "transparent"}
                  classExt={classnames(styles.memoryRow, { [styles.slotBoundary]: slotBoundaries.has(address) })}
                  hoverBackgroundColor="--bgcolor-disass-hover"
                  height={`${memoryRowItemSize}px`}
                >
                  {labelGutter && (
                    <span className={styles.gutter} style={{ width: `${LABEL_GUTTER_CH}ch` }}>
                      {gutterLabel && (
                        <span className={styles.gutterLabel} title={gutterLabel}>
                          {gutterLabel}
                        </span>
                      )}
                      {tags.slice(0, 2).map((tag) => (
                        <span key={tag} className={styles.registerTag} title={t("panels.memoryView.pointedBy", { register: tag })}>
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                  <MemoryDumpSectionView
                    showPartitions={showPartitionColumn}
                    partitionLabel={rowPartitionLabel(address)}
                    partitionWidthCh={partitionWidthCh}
                    address={address}
                    bytes={bytes as unknown as readonly number[]}
                    heatSteps={heat}
                    heatTooltipOf={heatTooltipOf}
                    characterInfo={memoryCharacterInfo}
                    charDump={charDump}
                    pointedInfo={pointedInView}
                    decimalView={decimalView}
                    lastJumpAddress={lastJumpAddress}
                    isRom={isRom}
                    editClicked={editMemoryContent}
                    marks={marks}
                    onBytePointer={handleBytePointer}
                  />
                </HStack>
              );
            }}
          />
        </div>
        {inspectorShown && (
          <MemoryInspector
            cursor={cursor}
            memory={memory}
            decimal={decimalView}
            location={cursorLocation}
            cpuAddress={cursorCpu}
            roles={cursorLocation ? memoryRefresh.partitionRoles?.[cursorLocation.partition.id] : undefined}
            label={cursorLabel ? { name: cursorLabel.name, origin: cursorLabel.origin } : undefined}
            wordLabel={wordLabel}
            pointedBy={pointedInView[cursor]}
            changed={!!baseline && baseline.length === memory.length && baseline[cursor] !== memory[cursor]}
            selection={selection}
            heat={heatSteps ? heatTooltipOf(cursor) : undefined}
            z80={isZ80}
            z80n={z80n}
            charSet={memoryCharacterInfo.characterSet}
            partitionLabelOf={partitionLabelOf}
            readOnlyReason={readOnlyReason(cursor)}
            onSet={(value, size, bigEndian) => void writeBytes(cursor, valueBytes(value, size, bigEndian))}
            onGoTo={(address) => goToTarget({ kind: "address", address })}
            onOpenInDisassembly={openInDisassembly}
            onShowAsGraphics={() => {
              const from = selection ? selection[0] : cursor;
              const cpu = cpuAddressOfView(from);
              if (cpu !== undefined) void ideCommandsService.executeCommand(`gfx $${toHexa4(cpu)}`);
            }}
            onFindBytes={(pattern) => {
              setFindText(pattern);
              setFindResult(undefined);
            }}
            onBreakpoint={setBreakpoint}
            onWatch={cursorLabel ? () => void ideCommandsService.executeCommand(`w-add ${cursorLabel.name}:w`) : undefined}
          />
        )}
      </div>
    </div>
  );
};

/** Hex of the cursor byte, for tests */
export const formatCursorByte = (value: number) => `$${toHexa2(value)}`;

// --- Re-render only when the document changes; everything else is the panel's own state
const arePropsEqual = (prevProps: DocumentProps, nextProps: DocumentProps) =>
  prevProps.document?.id === nextProps.document?.id;

export const createMemoryPanel = memo(BankedMemoryPanel, arePropsEqual);
