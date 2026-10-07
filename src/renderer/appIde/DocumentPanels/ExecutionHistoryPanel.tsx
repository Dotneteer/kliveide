import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import classnames from "classnames";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { MEMORY_PANEL_ID } from "@common/state/common-ids";
import { MF_EXEC_HISTORY, MI_ZXNEXT } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import type { Z80CpuState } from "@common/messaging/EmuApi";
import { historyContextDecoder } from "@common/history/contexts";
import {
  decodeHistoryPage,
  HistoryKind,
  type HistoryRecord,
  type HistoryRegisters
} from "@common/history/historyRecord";
import { classifyFlow, type FlowKind } from "@common/history/flowKind";
import { formatRegisterDiff, registerDiff } from "@common/history/registerDiff";
import { formatHistoryRow, historyRowCells, isSeparatorRecord } from "@common/history/historyRow";
import { serviceSpanText, type HistoryServiceSpan } from "@common/history/serviceSpans";
import { integerSymbolsOf } from "@common/utils/breakpoint-condition/integer-symbols";
import { SmallIconButton } from "@controls/IconButton";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { ToolbarSeparator } from "@controls/ToolbarSeparator";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@controls/ContextMenu";
import {
  DataLabel,
  DataRow,
  DataValue,
  EmptyState,
  PanelFilter,
  PanelHeader,
  PartitionPrefix,
  SectionHeader
} from "@renderer/controls/data";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { VirtualizedList, type VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { revealWhenMounted } from "@renderer/appIde/navigation/addressNavigationAdapters";
import { locateSource } from "@renderer/appIde/utils/source-location";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import {
  HistoryDisassemblyCache,
  historyLabelLookup
} from "@renderer/features/history/historyDisassembly";
import {
  foldedHistoryRows,
  historyCountText,
  historyEmptyMessage,
  historyRecordAt,
  historyRowMatches,
  historyRowOf,
  historySequenceAt,
  historyStepOf,
  initialHistoryViewState,
  missingHistoryPages,
  parseHistoryFilter,
  readFoldPreference,
  reduceHistoryView,
  writeFoldPreference
} from "@renderer/features/history/historyViewModel";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./ExecutionHistoryPanel.module.scss";

/**
 * The Execution History document (`$history`, `.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.6, G4.1):
 * the last instructions the CPU ran in this debug session, newest at the bottom, with the registers
 * each one changed and the source line it came from. Read-only: it reads the core's ring when the
 * machine stops, by sequence number, a page at a time (§4.6.3).
 */

/** How many records a full-ring read (the filter, "copy rows") asks for at once */
const BULK_READ = 8192;
/** "Copy rows as text" stops here */
const MAX_COPY_ROWS = 10000;

const FLOW_ICONS: Partial<Record<FlowKind, string>> = {
  call: "→",
  rst: "→",
  ret: "←",
  jump: "↷",
  int: "⚡",
  nmi: "⚡",
  halt: "⏸",
  dma: "⇄"
};

const REGISTER_ROWS: [keyof HistoryRegisters, string][] = [
  ["af", "AF"],
  ["bc", "BC"],
  ["de", "DE"],
  ["hl", "HL"],
  ["af_", "AF'"],
  ["bc_", "BC'"],
  ["de_", "DE'"],
  ["hl_", "HL'"],
  ["ix", "IX"],
  ["iy", "IY"],
  ["sp", "SP"],
  ["pc", "PC"],
  ["ir", "IR"],
  ["wz", "WZ"]
];

const ExecutionHistoryPanel = (_props: DocumentProps) => {
  const emuApi = useEmuApi();
  const { ideCommandsService } = useAppServices();
  const documentHubService = useDocumentHubService();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const isDebugging = useSelector((s) => s.emulatorState?.isDebugging);
  const compilation = useSelector((s) => s.compilation?.result) as KliveCompilerOutput | undefined;

  const [state, dispatch] = useReducer(reduceHistoryView, initialHistoryViewState);
  const [partitionLabels, setPartitionLabels] = useState<Record<number, string>>({});
  const [liveRegs, setLiveRegs] = useState<HistoryRegisters>();
  const [disassemblyVersion, setDisassemblyVersion] = useState(0);
  const [filteredSequences, setFilteredSequences] = useState<number[]>();
  // --- Folded interrupt service (EXECUTION_HISTORY_ALL_CORES_PLAN D10): the spans of the last stop,
  // --- the user's choice per machine, and the spans they opened
  const [spans, setSpans] = useState<HistoryServiceSpan[]>([]);
  const [foldService, setFoldService] = useState(() => readFoldPreference(machineId));
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  useEffect(() => {
    setFoldService(readFoldPreference(machineId));
    setExpanded(new Set());
  }, [machineId]);
  const [menuState, menuApi] = useContextMenuState();
  const listApi = useRef<VirtualizedListApi>(null);
  const loading = useRef(new Set<string>());
  const stateRef = useRef(state);
  stateRef.current = state;

  const supported = !!machineRegistry.find((m) => m.machineId === machineId)?.features?.[
    MF_EXEC_HISTORY
  ];
  const running = machineState === MachineControllerState.Running;
  const info = state.info;
  const contextDecoder = historyContextDecoder(info?.machineId);

  // --- Disassembly with the current compilation's labels, one cache per compilation (T12)
  const symbols = (compilation as { symbols?: Record<string, unknown> } | undefined)?.symbols;
  const disassembly = useMemo(
    () => new HistoryDisassemblyCache(machineId === MI_ZXNEXT, historyLabelLookup(symbols)),
    [machineId, symbols]
  );
  const filter = useMemo(
    () => parseHistoryFilter(state.filter, integerSymbolsOf(symbols)),
    [state.filter, symbols]
  );

  // --- Refresh on every stop (§4.6.3); nothing while the machine runs
  const refresh = useCallback(
    async (controllerState: MachineControllerState) => {
      if (controllerState === MachineControllerState.Running) return;
      const newInfo = await emuApi.getHistoryInfo();
      dispatch({ type: "infoLoaded", info: newInfo });
      setSpans(newInfo?.count ? ((await emuApi.getHistoryServiceSpans()) ?? []) : []);
      if (newInfo?.count) {
        const cpu = (await emuApi.getCpuState()) as Z80CpuState;
        setLiveRegs({
          pc: cpu.pc,
          af: cpu.af,
          bc: cpu.bc,
          de: cpu.de,
          hl: cpu.hl,
          af_: cpu.af_,
          bc_: cpu.bc_,
          de_: cpu.de_,
          hl_: cpu.hl_,
          ix: cpu.ix,
          iy: cpu.iy,
          sp: cpu.sp,
          ir: cpu.ir,
          wz: cpu.wz,
          iff1: cpu.iff1,
          iff2: cpu.iff2,
          interruptMode: cpu.interruptMode
        });
      }
    },
    [emuApi]
  );
  useEmuStateListener(emuApi, refresh);
  useEffect(() => {
    emuApi
      .getPartitionLabels()
      .then(setPartitionLabels)
      .catch(() => setPartitionLabels({}));
  }, [emuApi, machineId]);

  // --- Load pages by sequence, then disassemble what they hold
  const loadRange = useCallback(
    async (from: number, to: number) => {
      const current = stateRef.current;
      if (!current.info) return;
      const generation = current.info.generation;
      for (const [start, count] of missingHistoryPages(current, from, to)) {
        const key = `${generation}:${start}:${count}`;
        if (loading.current.has(key)) continue;
        loading.current.add(key);
        try {
          const page = await emuApi.getHistoryRecords(start, count);
          if (!page) continue;
          const records = decodeHistoryPage(page);
          dispatch({ type: "pageLoaded", generation, firstSequence: page.firstSequence, records });
          await Promise.all(records.map((r) => disassembly.disassemble(r)));
          setDisassemblyVersion((v) => v + 1);
        } finally {
          loading.current.delete(key);
        }
      }
    },
    [emuApi, disassembly]
  );

  /**
   * Reads a range of records straight from the ring, in bulk, and files them in the cache as it goes:
   * for the whole-ring passes (the filter, "copy rows"), which need the records themselves, not a
   * re-render
   */
  const readRecords = useCallback(
    async (
      from: number,
      to: number,
      isCanceled: () => boolean = () => false
    ): Promise<HistoryRecord[]> => {
      const generation = stateRef.current.info?.generation;
      if (generation === undefined) return [];
      const out: HistoryRecord[] = [];
      for (let start = from; start <= to && !isCanceled(); start += BULK_READ) {
        const page = await emuApi.getHistoryRecords(start, Math.min(BULK_READ, to - start + 1));
        if (!page) break;
        const records = decodeHistoryPage(page);
        dispatch({ type: "pageLoaded", generation, firstSequence: page.firstSequence, records });
        await Promise.all(records.map((r) => disassembly.disassemble(r)));
        out.push(...records);
      }
      setDisassemblyVersion((v) => v + 1);
      return out;
    },
    [emuApi, disassembly]
  );

  // --- The filter reads the whole ring: an address filter needs every PC, a text filter every
  // --- instruction (cached by bytes, so a loop costs one disassembly)
  useEffect(() => {
    if (filter.kind === "none" || !info?.count) {
      setFilteredSequences(undefined);
      return undefined;
    }
    let canceled = false;
    (async () => {
      const records = await readRecords(info.oldestSequence, info.newestSequence, () => canceled);
      if (canceled) return;
      const matches: number[] = [];
      for (const r of records) {
        const text =
          filter.kind === "text"
            ? (disassembly.peek(r)?.text ??
              historyRowCells({ record: r, step: 0, machineId: info.machineId }).instruction)
            : undefined;
        if (historyRowMatches(filter, r, text)) matches.push(r.sequence);
      }
      setFilteredSequences(matches);
    })().catch(() => {});
    return () => {
      canceled = true;
    };
  }, [filter, info, readRecords, disassembly]);

  // --- The rows: every held sequence with interrupt service folded (D10), or the filter's matches
  // --- (a filter shows every match, folded or not)
  useEffect(() => setExpanded(new Set()), [info?.generation]);
  const folded = useMemo(
    () => (foldService && !filteredSequences ? foldedHistoryRows(info, spans, expanded) : undefined),
    [foldService, filteredSequences, info, spans, expanded]
  );
  const spanByFirst = useMemo(() => new Map(spans.map((span) => [span.first, span])), [spans]);
  const rowCount = filteredSequences ? filteredSequences.length : (folded?.count ?? info?.count ?? 0);
  const rowItems = useMemo(() => new Array<number>(rowCount).fill(0), [rowCount]);
  const sequenceOfRow = useCallback(
    (row: number) =>
      filteredSequences
        ? filteredSequences[row]
        : folded
          ? folded.sequenceAt(row)
          : historySequenceAt(state, row),
    [filteredSequences, folded, state]
  );
  const rowOfSequence = useCallback(
    (sequence: number) =>
      filteredSequences
        ? filteredSequences.indexOf(sequence)
        : folded
          ? folded.rowOf(sequence)
          : historyRowOf(state, sequence),
    [filteredSequences, folded, state]
  );
  const toggleSpan = (first: number) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(first)) next.add(first);
      return next;
    });

  // --- Follow the newest record after every stop. The list may mount after this effect (it replaces
  // --- an empty state), so `apiLoaded` scrolls too, and the scroll waits a frame for the layout.
  const scrollToNewest = useCallback(() => {
    if (!stateRef.current.followNewest || rowCount === 0) return;
    requestAnimationFrame(() => listApi.current?.scrollToIndex(rowCount - 1, { align: "end" }));
  }, [rowCount]);
  useEffect(() => {
    scrollToNewest();
  }, [scrollToNewest, state.followNewest, info?.newestSequence]);

  // --- Rows ask for their pages as they come into view
  const pendingLoad = useRef<{ from: number; to: number }>();
  const requestLoad = (sequence: number) => {
    const p = pendingLoad.current;
    pendingLoad.current = p
      ? { from: Math.min(p.from, sequence), to: Math.max(p.to, sequence) }
      : { from: sequence, to: sequence };
    if (!p) {
      queueMicrotask(() => {
        const range = pendingLoad.current;
        pendingLoad.current = undefined;
        // --- One more for the row's "after" state, which is the next record
        if (range) void loadRange(range.from, range.to + 1);
      });
    }
  };

  // --- The state after a record: the next record's, or the live CPU for the newest (D3)
  const afterOf = (record: HistoryRecord): HistoryRegisters | undefined =>
    record.sequence === info?.newestSequence
      ? liveRegs
      : historyRecordAt(state, record.sequence + 1)?.regs;

  const partitionOf = (record: HistoryRecord) =>
    contextDecoder?.partitionFor(record.context, record.regs.pc);
  const partitionLabelOf = (record: HistoryRecord) => {
    const p = partitionOf(record);
    return p === undefined ? "" : (partitionLabels[p] ?? "");
  };
  const partitionWidth = Math.max(2, ...Object.values(partitionLabels).map((l) => l.length));
  const sourceOf = (record: HistoryRecord) =>
    record.kind === HistoryKind.Instruction
      ? locateSource(compilation, record.regs.pc, undefined, {
          partition: partitionOf(record),
          machineId
        })
      : undefined;
  const sourceText = (record: HistoryRecord) => {
    const location = sourceOf(record);
    return location ? `${location.filename.split(/[\\/]/).pop()}:${location.line}` : undefined;
  };
  const rowInput = (record: HistoryRecord) => {
    const instruction = disassembly.peek(record);
    const after = afterOf(record);
    return {
      record,
      step: historyStepOf(state, record.sequence),
      machineId: info?.machineId,
      instruction: instruction?.text,
      length: instruction?.length,
      source: sourceText(record),
      changes:
        after && record.kind === HistoryKind.Instruction
          ? formatRegisterDiff(registerDiff(record.regs, after))
          : undefined,
      partitionLabel: partitionLabelOf(record)
    };
  };

  // --- Actions
  const select = (sequence: number | undefined) => dispatch({ type: "selected", sequence });
  const goToSource = async (record: HistoryRecord) => {
    const location = sourceOf(record);
    if (location) {
      await ideCommandsService.executeCommand(
        `nav "${location.filename}" ${location.line} -r breakpoint`
      );
    } else {
      await showInDisassembly(record);
    }
  };
  const showInDisassembly = (record: HistoryRecord) =>
    ideCommandsService.executeCommand(`show-disass $${hex4(record.regs.pc)}`);
  const showInMemory = async (record: HistoryRecord) => {
    const result = await ideCommandsService.executeCommand("show-memory");
    if (!result?.success) return;
    await revealWhenMounted(documentHubService, MEMORY_PANEL_ID, {
      kind: "address",
      address: record.regs.pc,
      segment: null,
      fullView: true,
      viewMode: "memory"
    });
  };
  const setBreakpoint = (record: HistoryRecord) => {
    const p = partitionOf(record);
    const label = p === undefined ? undefined : partitionLabels[p];
    return ideCommandsService.executeCommand(
      `bp-set ${label ? `${label}:` : ""}$${hex4(record.regs.pc)}`
    );
  };
  const copyText = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});
  const copyRows = async (fromSequence: number) => {
    if (!info) return;
    const to = info.newestSequence;
    const from = Math.max(fromSequence, to - MAX_COPY_ROWS + 1);
    const records = await readRecords(from, to);
    const shown = filteredSequences ? new Set(filteredSequences) : undefined;
    const lines: string[] = [];
    records.forEach((r, i) => {
      if (shown && !shown.has(r.sequence)) return;
      const next = records[i + 1]?.regs ?? (r.sequence === to ? liveRegs : undefined);
      const instruction = disassembly.peek(r);
      lines.push(
        formatHistoryRow({
          ...rowInput(r),
          instruction: instruction?.text,
          length: instruction?.length,
          changes:
            next && r.kind === HistoryKind.Instruction
              ? formatRegisterDiff(registerDiff(r.regs, next))
              : undefined
        })
      );
    });
    await copyText(lines.join("\n"));
  };

  const selectedRecord =
    state.selected !== undefined ? historyRecordAt(state, state.selected) : undefined;
  const fromMenu = (action: (r: HistoryRecord) => unknown) => () => {
    menuApi.conceal();
    if (selectedRecord) void action(selectedRecord);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (state.selected === undefined) return;
    const row = rowOfSequence(state.selected);
    if (e.key === "Enter" && selectedRecord) {
      e.preventDefault();
      void goToSource(selectedRecord);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(0, Math.min(rowCount - 1, row + (e.key === "ArrowUp" ? -1 : 1)));
      const sequence = sequenceOfRow(next);
      if (sequence !== undefined) {
        select(sequence);
        listApi.current?.scrollToIndex(next, { align: "nearest" });
      }
    }
  };

  // --- Empty states (§4.6.1)
  const empty = historyEmptyMessage({ supported, running, debugging: !!isDebugging }, info);
  const header = (
    <PanelHeader>
      <span className={styles.count}>{historyCountText(info)}</span>
      <ToolbarSeparator small={true} />
      <span
        className={classnames(styles.recording, { [styles.recordingOn]: info?.enabled })}
        title="History is recorded in debug sessions only: Start with Debugging and the steps"
      >
        {info?.enabled ? "● Recording" : "○ Not recording"}
      </span>
      <ToolbarSeparator small={true} />
      <LabeledSwitch
        value={state.followNewest}
        label="Follow newest:"
        title="Keep the newest record in view after every stop"
        clicked={(follow) => dispatch({ type: "followChanged", follow })}
      />
      <ToolbarSeparator small={true} />
      <LabeledSwitch
        value={foldService}
        label="Fold interrupts:"
        title="Show each interrupt and its service routine as one row you can open"
        clicked={(fold) => {
          setFoldService(fold);
          writeFoldPreference(machineId, fold);
        }}
      />
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName="clear-all"
        title="Clear the execution history"
        enable={supported && !!info?.count}
        clicked={async () => {
          await ideCommandsService.executeCommand("history-clear");
          await refresh(machineState ?? MachineControllerState.Paused);
        }}
      />
      <ToolbarSeparator small={true} />
      <PanelFilter
        value={state.filter}
        onChange={(value) => dispatch({ type: "filterChanged", filter: value })}
        placeholder="$8000-$80FF, label, or text"
        label="Filter the execution history"
        status={
          filteredSequences ? `${filteredSequences.length.toLocaleString("en-US")} rows` : undefined
        }
      />
    </PanelHeader>
  );

  if (empty) {
    return (
      <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
        {header}
        <EmptyState message={empty} />
      </FullPanel>
    );
  }

  const renderRow = (row: number) => {
    const sequence = sequenceOfRow(row);
    if (sequence === undefined) return null;
    const record = historyRecordAt(state, sequence);
    if (!record) {
      requestLoad(sequence);
      return <div className={styles.row}>&nbsp;</div>;
    }
    if (!afterOf(record) && record.sequence !== info?.newestSequence) requestLoad(sequence + 1);
    const cells = historyRowCells(rowInput(record));
    const previous = historyRecordAt(state, sequence - 1);
    const newFrame = previous !== undefined && previous.frame !== record.frame;
    const flow = classifyFlow(record, afterOf(record)?.pc);
    const selected = state.selected === sequence;
    // --- An INT or NMI that starts a service span: folded, or opened by the user
    const span = folded && !filteredSequences ? spanByFirst.get(sequence) : undefined;
    const isFolded = !!span && !!folded?.foldedAt(sequence);
    const separatorText = span
      ? isFolded
        ? serviceSpanText(span, contextDecoder?.frameTactsPerBaseT)
        : cells.instruction
      : cells.instruction;
    return (
      <div
        className={classnames(styles.row, {
          [styles.separatorRow]: cells.separator,
          [styles.selectedRow]: selected,
          [styles.newestRow]: sequence === info?.newestSequence,
          [styles.frameStart]: newFrame
        })}
        title={newFrame ? `Frame ${record.frame}` : undefined}
        onClick={() => select(sequence)}
        onDoubleClick={() => void goToSource(record)}
        onContextMenu={(e: ReactMouseEvent) => {
          e.preventDefault();
          select(sequence);
          menuApi.show(e);
        }}
      >
        <span className={styles.step}>{cells.step}</span>
        <span className={styles.time}>{cells.time}</span>
        {cells.separator ? (
          <span className={styles.separator}>
            {span && (
              <span
                className={styles.fold}
                role="button"
                aria-expanded={!isFolded}
                title={isFolded ? "Show the service's instructions" : "Fold the service into this row"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSpan(span.first);
                }}
              >
                {isFolded ? "▸" : "▾"}
              </span>
            )}
            {separatorText}
          </span>
        ) : (
          <>
            <span className={styles.address}>
              {partitionLabels && Object.keys(partitionLabels).length > 0 && (
                <PartitionPrefix label={partitionLabelOf(record)} width={partitionWidth} />
              )}
              {hex4(record.regs.pc)}
            </span>
            <span className={styles.bytes}>{cells.bytes}</span>
            <span className={styles.flow} title={flow.taken === false ? "not taken" : flow.kind}>
              {flow.taken === false ? "" : (FLOW_ICONS[flow.kind] ?? "")}
            </span>
            <span className={styles.instruction}>{cells.instruction}</span>
            <span className={styles.source}>{cells.source}</span>
            <span className={styles.changes}>{cells.changes}</span>
          </>
        )}
      </div>
    );
  };

  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      {header}
      <div
        className={styles.body}
        tabIndex={0}
        onKeyDown={onKeyDown}
        data-version={disassemblyVersion}
      >
        <div
          className={styles.table}
          onWheel={(e) => {
            // --- Scrolling back through the history stops following the newest; the switch turns it on
            if (e.deltaY < 0 && state.followNewest)
              dispatch({ type: "followChanged", follow: false });
          }}
        >
          <VirtualizedList
            items={rowItems}
            apiLoaded={(api) => {
              const first = !listApi.current;
              listApi.current = api;
              if (first) scrollToNewest();
            }}
            renderItem={(idx) => <div key={idx}>{renderRow(idx)}</div>}
          />
        </div>
        {selectedRecord && (
          <HistoryDetail
            record={selectedRecord}
            after={selectedRecord ? afterOf(selectedRecord) : undefined}
            context={
              selectedRecord && contextDecoder?.describe(selectedRecord.context, partitionLabels)
            }
            frameTactUnit={contextDecoder?.frameTactUnit}
            newest={selectedRecord?.sequence === info?.newestSequence}
            step={selectedRecord ? historyStepOf(state, selectedRecord.sequence) : 0}
          />
        )}
      </div>
      <ContextMenu state={menuState} onClickOutside={() => menuApi.conceal()}>
        <ContextMenuItem text="Go to source" clicked={fromMenu(goToSource)} />
        <ContextMenuItem text="Show in disassembly" clicked={fromMenu(showInDisassembly)} />
        <ContextMenuItem text="Show in memory" clicked={fromMenu(showInMemory)} />
        <ContextMenuSeparator />
        <ContextMenuItem
          text="Copy row"
          clicked={fromMenu((r) => copyText(formatHistoryRow(rowInput(r))))}
        />
        <ContextMenuItem
          text="Copy rows as text (to the newest)"
          clicked={fromMenu((r) => copyRows(r.sequence))}
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          text="Set breakpoint here"
          clicked={fromMenu((r) =>
            r.kind === HistoryKind.Instruction ? setBreakpoint(r) : undefined
          )}
        />
      </ContextMenu>
    </FullPanel>
  );
};

/** The detail pane: the full register set before and after the selected record (§4.6.1) */
const HistoryDetail = ({
  record,
  after,
  context,
  frameTactUnit,
  newest,
  step
}: {
  record?: HistoryRecord;
  after?: HistoryRegisters;
  context?: string;
  frameTactUnit?: string;
  newest: boolean;
  step: number;
}) => {
  if (!record) return <div className={styles.detail} />;
  const before = record.regs;
  return (
    <div className={styles.detail}>
      <SectionHeader
        title={`Step ${String(step).replace("-", "−")}${isSeparatorRecord(record) ? "" : ` at $${hex4(before.pc)}`}`}
      />
      <DataRow dense={true}>
        <DataLabel text="Reg" width="5ch" />
        <DataValue text="Before" width="6ch" />
        <DataValue text={newest ? "After (now)" : "After"} width="11ch" />
      </DataRow>
      {REGISTER_ROWS.map(([key, name]) => {
        const a = before[key] as number;
        const b = after?.[key] as number | undefined;
        return (
          <DataRow key={key} dense={true}>
            <DataLabel text={name} width="5ch" />
            <DataValue text={hex4(a)} width="6ch" />
            <DataValue
              text={b === undefined ? "" : hex4(b)}
              width="11ch"
              changed={b !== undefined && a !== b}
            />
          </DataRow>
        );
      })}
      <DataRow dense={true}>
        <DataLabel text="IFF1" width="5ch" />
        <DataValue text={before.iff1 ? "1" : "0"} width="6ch" />
        <DataValue
          text={after ? (after.iff1 ? "1" : "0") : ""}
          width="11ch"
          changed={!!after && after.iff1 !== before.iff1}
        />
      </DataRow>
      <DataRow dense={true}>
        <DataLabel text="IM" width="5ch" />
        <DataValue text={String(before.interruptMode)} width="6ch" />
        <DataValue
          text={after ? String(after.interruptMode) : ""}
          width="11ch"
          changed={!!after && after.interruptMode !== before.interruptMode}
        />
      </DataRow>
      <SectionHeader title="When" />
      <DataRow dense={true}>
        <DataLabel text="Frame" width="7ch" />
        <DataValue text={record.frame.toLocaleString("en-US")} />
      </DataRow>
      <DataRow dense={true}>
        <DataLabel text="Tact" width="7ch" />
        <DataValue
          text={`${record.frameTact.toLocaleString("en-US")}${frameTactUnit ? ` (${frameTactUnit})` : ""}`}
        />
      </DataRow>
      {record.repeat > 1 && (
        <DataRow dense={true}>
          <DataLabel text={record.kind === HistoryKind.DmaHold ? "Held" : "Repeats"} width="7ch" />
          <DataValue
            text={`${record.repeat.toLocaleString("en-US")}${record.kind === HistoryKind.DmaHold ? " T" : ""}`}
          />
        </DataRow>
      )}
      {context && record.kind === HistoryKind.Instruction && (
        <>
          <SectionHeader title="Memory map" />
          <div className={styles.context}>{context}</div>
        </>
      )}
    </div>
  );
};

function hex4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

export const createExecutionHistoryPanel = ({ document, viewState }: DocumentProps) => (
  <ExecutionHistoryPanel document={document} viewState={viewState} />
);
