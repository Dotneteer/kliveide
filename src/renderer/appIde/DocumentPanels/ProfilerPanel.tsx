import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import classnames from "classnames";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { MF_PROFILE } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { PANE_ID_BUILD } from "@common/integration/constants";
import { PROFILE_EXPORT_FOLDER, PROFILE_FILE_FILTERS, profileFormatOfName } from "@common/profile/profileExport";
import type { AddressRow, CallNode, FlatRow } from "@common/profile/profileRollup";
import { SmallIconButton } from "@controls/IconButton";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { ToolbarSeparator } from "@controls/ToolbarSeparator";
import { EmptyState, PanelHeader } from "@renderer/controls/data";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useMainApi } from "@renderer/core/MainApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import {
  buildProfilerModel,
  flattenCallTree,
  formatPct,
  formatTime,
  formatWallTime,
  profileHeaderFacts,
  profilerEmptyMessage,
  readProfileSnapshot,
  unitShort,
  type ProfilerModel
} from "@renderer/features/profiler/profilerModel";
import styles from "./ProfilerPanel.module.scss";

/**
 * The Profiler document (`$profiler`, `.plans/PROFILER_PLAN.md` D14): where the time went, as a
 * flat "top routines" table (G5.3), the raw per-instruction view, and - when the call tracker ran -
 * the call tree and a routine's callers (G5.4). It re-reads the profile whenever the machine
 * controller says it moved (`profileVersion`), and rolls it up with `src/common/profile/`.
 */

type ProfilerTab = "routines" | "addresses" | "tree" | "callers";
type RoutineSort = "self" | "calls" | "instructions";

const TABS: { id: ProfilerTab; label: string }[] = [
  { id: "routines", label: "Routines" },
  { id: "addresses", label: "Addresses" },
  { id: "tree", label: "Call tree" },
  { id: "callers", label: "Callers" }
];

const n = (v: number) => Math.round(v).toLocaleString("en-US");

const ProfilerPanel = (_props: DocumentProps) => {
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const { ideCommandsService, outputPaneService } = useAppServices();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const profileVersion = useSelector((s) => s.emulatorState?.profileVersion);
  const profiling = useSelector((s) => s.emulatorState?.profiling);
  const advancedDebugging = useSelector((s) => s.emulatorState?.advancedDebugging) === true;
  const compilation = useSelector((s) => s.compilation?.result) as KliveCompilerOutput | undefined;
  const supported =
    advancedDebugging && !!machineRegistry.find((m) => m.machineId === machineId)?.features?.[MF_PROFILE];

  const [tab, setTab] = useState<ProfilerTab>("routines");
  const [hideWaiting, setHideWaiting] = useState(true);
  const [withCalls, setWithCalls] = useState(true);
  const [sort, setSort] = useState<RoutineSort>("self");
  const [selected, setSelected] = useState<string | undefined>();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [model, setModel] = useState<ProfilerModel | undefined>();
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  // --- Re-read on every move of the profile, a new build or a change of the waiting switch
  useEffect(() => {
    if (!supported) {
      setModel(undefined);
      return;
    }
    const mine = ++generation.current;
    void (async () => {
      try {
        const snapshot = await readProfileSnapshot(emuApi);
        if (mine !== generation.current) return;
        setModel(snapshot ? buildProfilerModel(snapshot, compilation, { hideWaiting }) : undefined);
      } catch {
        if (mine === generation.current) setModel(undefined);
      }
    })();
  }, [emuApi, supported, profileVersion, compilation, hideWaiting, machineId]);

  const routineRows = useMemo(() => {
    if (!model) return [];
    const rows = model.flat.rows.filter((r) => !r.pseudo);
    const pseudo = model.flat.rows.filter((r) => r.pseudo);
    const key = (r: FlatRow) => (sort === "calls" ? r.calls : sort === "instructions" ? r.instructions : r.selfTime);
    return [...rows.sort((a, b) => key(b) - key(a) || b.selfTime - a.selfTime), ...pseudo];
  }, [model, sort]);
  const treeRows = useMemo(() => (model?.graph ? flattenCallTree(model.graph, expanded) : []), [model, expanded]);

  const run = async (command: string) => {
    setBusy(true);
    try {
      const result = await ideCommandsService.executeCommand(command, outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD));
      if (result && !result.success && result.finalMessage) {
        await mainApi.displayMessageBox("error", "Profiler", result.finalMessage);
      }
    } finally {
      setBusy(false);
    }
  };

  const exportProfile = async () => {
    const file = await mainApi.showSaveFileDialog({
      title: "Export Profile",
      defaultPath: `${machineId ?? "machine"}-profile.json`,
      filters: PROFILE_FILE_FILTERS,
      settingsId: PROFILE_EXPORT_FOLDER
    });
    if (!file) return;
    const format = profileFormatOfName(file) ?? "speedscope";
    const options = [
      `-format ${format}`,
      "-f",
      hideWaiting ? "" : "-waiting",
      format === "csv" && tab === "addresses" ? "-addresses" : ""
    ].filter(Boolean);
    await run(`profile export "${file}" ${options.join(" ")}`);
  };

  /** Double-click (D14): to the routine's source, else to its code in the disassembly */
  const goTo = async (routine?: { file?: string; line?: number; entry: number }) => {
    if (!routine) return;
    if (routine.file && routine.line) {
      await ideCommandsService.executeCommand(`nav "${routine.file}" ${routine.line} -r profiler`);
    } else {
      await ideCommandsService.executeCommand(`show-disass $${hex4(routine.entry)}`);
    }
  };

  const status = model?.snapshot.status;
  const running = !!profiling?.enabled;
  const unit = status ? unitShort(status) : "T";
  const empty = profilerEmptyMessage({ supported, switchedOff: !advancedDebugging, model });

  const header = (
    <PanelHeader>
      <span className={styles.tabs} role="tablist" aria-label="Profiler view">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </span>
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName="play"
        title={withCalls ? "Start profiling, with the call graph (resets the profile)" : "Start profiling (resets the profile)"}
        enable={supported && !busy && !running}
        clicked={() => run(`profile start${withCalls ? " -calls" : ""}`)}
      />
      <SmallIconButton
        iconName="pause"
        title="Stop profiling: the profile stays"
        enable={supported && !busy && running}
        clicked={() => run("profile stop")}
      />
      <SmallIconButton
        iconName="clear-all"
        title="Clear the profile"
        enable={supported && !busy && !!status?.timeTotal}
        clicked={() => run("profile reset")}
      />
      <SmallIconButton
        iconName="save"
        title="Export the profile: speedscope, callgrind, CSV or Fuse"
        enable={supported && !busy && !!status?.timeTotal}
        clicked={() => void exportProfile()}
      />
      <ToolbarSeparator small={true} />
      <LabeledSwitch
        value={withCalls}
        label="Call graph:"
        title="Start profiling with the call tracker: inclusive time, the call tree and callers"
        clicked={setWithCalls}
      />
      <ToolbarSeparator small={true} />
      <LabeledSwitch
        value={hideWaiting}
        label="Hide waiting:"
        title="Leave the time spent in HALT out of the table and the percentages"
        clicked={setHideWaiting}
      />
    </PanelHeader>
  );

  if (empty || !model || !status) {
    return (
      <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
        {header}
        <EmptyState message={empty ?? "Reading the profile..."} />
      </FullPanel>
    );
  }

  const facts = (
    <div className={styles.facts}>
      {profileHeaderFacts(model).map((f, i) => (
        <span key={i} className={classnames({ [styles.warning]: f.warning })} title={f.title}>
          {f.text}
        </span>
      ))}
    </div>
  );

  const partitionText = (p?: number) => (p === undefined ? "" : model.partitionLabel(p));
  // --- A machine without banks has no partition column
  const banked = model.layout.regions.length > 0;
  const timeTitle = (ticks: number) => formatWallTime(ticks, status.clockHz);
  const share = (pct: number) => (
    <span className={styles.share}>
      <span className={styles.shareBar} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      <span className={styles.shareText}>{formatPct(pct)}</span>
    </span>
  );
  const sortHeader = (key: RoutineSort, text: string, className: string) => (
    <span
      className={classnames(styles.number, className, styles.sortable)}
      title={`Sort by ${text.toLowerCase()}`}
      onClick={() => setSort(key)}
    >
      {sort === key ? `${text} ▾` : text}
    </span>
  );

  const routinesTab = () => (
    <>
      <div className={classnames(styles.row, styles.headerRow)}>
        <span className={styles.name}>Routine</span>
        {banked && <span className={styles.partition}>Part.</span>}
        <span className={styles.address}>Entry</span>
        {sortHeader("self", `Self (${unit})`, "")}
        <span className={styles.share}>Self %</span>
        {sortHeader("calls", model.flat.rows[0]?.callsFromGraph ? "Calls" : "Entries", styles.narrow)}
        {sortHeader("instructions", "Instr.", styles.narrow)}
        <span className={classnames(styles.number, styles.narrow)} title="Self time per call">
          Per call
        </span>
        <span className={styles.number} title="Self time per emulated frame (D5)">
          Per frame
        </span>
        <span className={styles.source}>Source</span>
      </div>
      <div className={styles.list}>
        <VirtualizedList
          items={routineRows}
          renderItem={(idx) => {
            const r = routineRows[idx];
            if (!r) return null;
            return (
              <div
                key={r.key}
                className={classnames(styles.row, {
                  [styles.pseudoRow]: !!r.pseudo,
                  [styles.selectedRow]: selected === r.key
                })}
                onClick={() => !r.pseudo && setSelected(r.key)}
                onDoubleClick={() => void goTo(r.routine)}
                title={
                  r.pseudo
                    ? "Time that is no routine's: the machine waiting or the hardware holding the CPU (D4)"
                    : r.source === "labels"
                      ? `${r.name}: up to the next label (${n(r.size ?? 0)} bytes)`
                      : r.name
                }
              >
                <span className={styles.name}>{r.name}</span>
                {banked && <span className={styles.partition}>{partitionText(r.partition)}</span>}
                <span className={styles.address}>{r.entry === undefined ? "" : `$${hex4(r.entry)}`}</span>
                <span className={styles.number} title={timeTitle(r.selfTime)}>
                  {n(r.selfTime)}
                </span>
                {share(r.selfPct)}
                <span className={classnames(styles.number, styles.narrow)}>{r.pseudo ? "" : n(r.calls)}</span>
                <span className={classnames(styles.number, styles.narrow)}>{r.pseudo ? "" : n(r.instructions)}</span>
                <span className={classnames(styles.number, styles.narrow)}>
                  {r.avgPerCall === undefined ? "" : n(r.avgPerCall)}
                </span>
                <span className={styles.number}>{r.perFrame === undefined ? "" : n(r.perFrame)}</span>
                <span className={styles.source}>{sourceText(r.file, r.line)}</span>
              </div>
            );
          }}
        />
      </div>
    </>
  );

  const addressesTab = () => (
    <>
      <div className={classnames(styles.row, styles.headerRow)}>
        {banked && <span className={styles.partition}>Part.</span>}
        <span className={styles.address}>Addr</span>
        <span className={styles.name}>Routine</span>
        <span className={styles.number}>Executions</span>
        <span className={styles.number}>{`Time (${unit})`}</span>
        <span className={styles.share}>Time %</span>
      </div>
      <div className={styles.list}>
        <VirtualizedList
          items={model.addresses}
          renderItem={(idx) => {
            const r: AddressRow | undefined = model.addresses[idx];
            if (!r) return null;
            return (
              <div
                key={r.offset}
                className={classnames(styles.row, { [styles.pseudoRow]: r.halt })}
                onDoubleClick={() => void goTo({ entry: r.address })}
                title={r.halt ? "A HALT: its time is the machine waiting" : undefined}
              >
                {banked && <span className={styles.partition}>{partitionText(r.partition)}</span>}
                <span className={styles.address}>{`$${hex4(r.address)}`}</span>
                <span className={styles.name}>
                  {r.routineOffset ? `${r.routine.name}+${r.routineOffset}` : r.routine.name}
                </span>
                <span className={styles.number}>{n(r.exec)}</span>
                <span className={styles.number} title={timeTitle(r.time)}>
                  {n(r.time)}
                </span>
                {share(r.pct)}
              </div>
            );
          }}
        />
      </div>
    </>
  );

  const noGraph = (
    <EmptyState message="No call graph: start profiling with the Call graph switch on, or with 'profile start -calls'." />
  );

  const treeColumns = (
    <div className={classnames(styles.row, styles.headerRow)}>
      <span className={styles.name}>Routine</span>
      <span className={classnames(styles.number, styles.narrow)}>Calls</span>
      <span className={styles.number} title="The time of these calls, the calls they made included">{`Incl. (${unit})`}</span>
      <span className={styles.share}>Incl. %</span>
      <span className={styles.number} title="The time of these calls in their own code">{`Excl. (${unit})`}</span>
      <span className={styles.source}>Source</span>
    </div>
  );
  const treeCells = (node: CallNode) => (
    <>
      <span className={classnames(styles.number, styles.narrow)}>{node.kind === "root" ? "" : n(node.calls)}</span>
      <span className={styles.number} title={timeTitle(node.inclusive)}>
        {n(node.inclusive)}
      </span>
      {share(status.timeTotal ? (100 * node.inclusive) / status.timeTotal : 0)}
      <span className={styles.number} title={timeTitle(node.exclusive)}>
        {n(node.exclusive)}
      </span>
      <span className={styles.source}>{sourceText(node.routine?.file, node.routine?.line)}</span>
    </>
  );
  const nodeTitle = (node: CallNode) =>
    node.recursive
      ? `${node.name} calls itself here (recursion): its inclusive time is counted at the outermost call`
      : node.kind === "root"
        ? "What ran outside every tracked call: the code that was running when profiling started, and its own time"
        : node.kind === "interrupt"
          ? "An interrupt is a root of its own: its time is not charged to the routine it interrupted"
          : node.open
            ? `${node.name}: still running when the profile was read; its time so far is included`
            : undefined;

  const treeTab = () =>
    !model.graph ? (
      noGraph
    ) : (
      <>
        {treeColumns}
        <div className={styles.list}>
          <VirtualizedList
            items={treeRows}
            renderItem={(idx) => {
              const row = treeRows[idx];
              if (!row) return null;
              const { node } = row;
              const toggle = () =>
                setExpanded((previous) => {
                  const next = new Set(previous);
                  if (next.has(row.pathKey)) next.delete(row.pathKey);
                  else next.add(row.pathKey);
                  return next;
                });
              return (
                <div
                  key={row.pathKey}
                  className={classnames(styles.row, {
                    [styles.pseudoRow]: node.kind !== "routine",
                    [styles.selectedRow]: selected === (node.routine?.key ?? node.key)
                  })}
                  onClick={() => node.routine && setSelected(node.routine.key)}
                  onDoubleClick={() => void goTo(node.routine)}
                  title={nodeTitle(node)}
                >
                  <span className={classnames(styles.name, styles.treeName)} style={{ paddingLeft: `${row.depth * 2}ch` }}>
                    <span
                      className={styles.toggle}
                      role="button"
                      aria-expanded={row.expandable ? row.expanded : undefined}
                      onClick={(e: ReactMouseEvent) => {
                        e.stopPropagation();
                        if (row.expandable) toggle();
                      }}
                    >
                      {row.expandable ? (row.expanded ? "▾" : "▸") : ""}
                    </span>
                    <span className={classnames({ [styles.recursive]: node.recursive })}>
                      {node.recursive ? `${node.name} ↺` : node.name}
                    </span>
                  </span>
                  {treeCells(node)}
                </div>
              );
            }}
          />
        </div>
      </>
    );

  const callersTab = () => {
    if (!model.graph) return noGraph;
    const subject = selected ? (model.graph.totals.get(selected) ?? undefined) : undefined;
    if (!subject) {
      return <EmptyState message="Select a routine in the Routines or Call tree tab to see who called it." />;
    }
    const callers = model.graph.callersOf(subject.key);
    const callees = model.graph.childrenOf({ ...subject, recursive: false });
    const list = (title: string, nodes: CallNode[]) => (
      <>
        <div className={styles.caption}>{title}</div>
        {nodes.map((node) => (
          <div
            key={`${title}:${node.key}`}
            className={classnames(styles.row, { [styles.pseudoRow]: node.kind !== "routine" })}
            onClick={() => node.routine && setSelected(node.routine.key)}
            onDoubleClick={() => void goTo(node.routine)}
            title={nodeTitle(node)}
          >
            <span className={styles.name}>{node.name}</span>
            {treeCells(node)}
          </div>
        ))}
      </>
    );
    return (
      <>
        <div className={styles.caption}>
          {`${subject.name}: ${n(subject.calls)} calls, ${formatTime(subject.inclusive, status)} inclusive, ` +
            `${formatTime(subject.exclusive, status)} exclusive`}
        </div>
        {treeColumns}
        <div className={styles.list} style={{ overflow: "auto" }}>
          {list(`Called by (${callers.length})`, callers)}
          {list(`Calls (${callees.length})`, callees)}
        </div>
      </>
    );
  };

  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      {header}
      {facts}
      <div className={styles.body}>
        {tab === "routines" && routinesTab()}
        {tab === "addresses" && addressesTab()}
        {tab === "tree" && treeTab()}
        {tab === "callers" && callersTab()}
      </div>
    </FullPanel>
  );
};

function sourceText(file?: string, line?: number): string {
  if (!file) return "";
  const name = file.replace(/\\/g, "/").split("/").pop();
  return line ? `${name}:${line}` : (name ?? "");
}

function hex4(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

export const createProfilerPanel = ({ document, viewState }: DocumentProps) => (
  <ProfilerPanel document={document} viewState={viewState} />
);
