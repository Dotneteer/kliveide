import {
  annotationRoutineLabelsForState,
  useAddressSymbols
} from "@renderer/appIde/annotations/useAddressSymbols";
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
import { useSelector, useRendererContext } from "@renderer/core/RendererProvider";
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
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";

/**
 * The Profiler document (`$profiler`, `.plans/PROFILER_PLAN.md` D14): where the time went, as a
 * flat "top routines" table (G5.3), the raw per-instruction view, and - when the call tracker ran -
 * the call tree and a routine's callers (G5.4). It re-reads the profile whenever the machine
 * controller says it moved (`profileVersion`), and rolls it up with `src/common/profile/`.
 */

type ProfilerTab = "routines" | "addresses" | "tree" | "callers";
type RoutineSort = "self" | "calls" | "instructions";

const TABS: { id: ProfilerTab; labelKey: MessageKey }[] = [
  { id: "routines", labelKey: "panels.doc.profiler.tab.routines" },
  { id: "addresses", labelKey: "panels.doc.profiler.tab.addresses" },
  { id: "tree", labelKey: "panels.doc.profiler.tab.tree" },
  { id: "callers", labelKey: "panels.doc.profiler.tab.callers" }
];

const n = (v: number) => Math.round(v).toLocaleString("en-US");

const ProfilerPanel = (_props: DocumentProps) => {
  const t = useT();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const { ideCommandsService, outputPaneService, projectService } = useAppServices();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const profileVersion = useSelector((s) => s.emulatorState?.profileVersion);
  const profiling = useSelector((s) => s.emulatorState?.profiling);
  const advancedDebugging = useSelector((s) => s.emulatorState?.advancedDebugging) === true;
  const compilation = useSelector((s) => s.compilation?.result) as KliveCompilerOutput | undefined;
  const { store } = useRendererContext();
  // --- The annotation and ROM labels name routines too; re-read when any of them changes
  const { symbols: addressSymbols } = useAddressSymbols(projectService);
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
        setModel(
          snapshot
            ? buildProfilerModel(snapshot, compilation, {
                hideWaiting,
                annotationLabels: annotationRoutineLabelsForState(store.getState())
              })
            : undefined
        );
      } catch {
        if (mine === generation.current) setModel(undefined);
      }
    })();
  }, [emuApi, supported, profileVersion, compilation, hideWaiting, machineId, addressSymbols, store]);

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
        await mainApi.displayMessageBox("error", t("panels.doc.profiler.errorTitle"), result.finalMessage);
      }
    } finally {
      setBusy(false);
    }
  };

  const exportProfile = async () => {
    const file = await mainApi.showSaveFileDialog({
      title: t("panels.doc.profiler.exportTitle"),
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
      <span className={styles.tabs} role="tablist" aria-label={t("panels.doc.profiler.tabsLabel")}>
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={tab === tabDef.id}
            onClick={() => setTab(tabDef.id)}
          >
            {t(tabDef.labelKey)}
          </button>
        ))}
      </span>
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName="play"
        title={t(withCalls ? "panels.doc.profiler.startWithCalls" : "panels.doc.profiler.start")}
        enable={supported && !busy && !running}
        clicked={() => run(`profile start${withCalls ? " -calls" : ""}`)}
      />
      <SmallIconButton
        iconName="pause"
        title={t("panels.doc.profiler.stop")}
        enable={supported && !busy && running}
        clicked={() => run("profile stop")}
      />
      <SmallIconButton
        iconName="clear-all"
        title={t("panels.doc.profiler.clear")}
        enable={supported && !busy && !!status?.timeTotal}
        clicked={() => run("profile reset")}
      />
      <SmallIconButton
        iconName="save"
        title={t("panels.doc.profiler.export")}
        enable={supported && !busy && !!status?.timeTotal}
        clicked={() => void exportProfile()}
      />
      <ToolbarSeparator small={true} />
      <LabeledSwitch
        value={withCalls}
        label={t("panels.doc.profiler.callGraph")}
        title={t("panels.doc.profiler.callGraphTitle")}
        clicked={setWithCalls}
      />
      <ToolbarSeparator small={true} />
      <LabeledSwitch
        value={hideWaiting}
        label={t("panels.doc.profiler.hideWaiting")}
        title={t("panels.doc.profiler.hideWaitingTitle")}
        clicked={setHideWaiting}
      />
    </PanelHeader>
  );

  if (empty || !model || !status) {
    return (
      <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
        {header}
        <EmptyState message={empty ?? t("panels.doc.profiler.reading")} />
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
  const sortHeader = (key: RoutineSort, text: string, sortTitle: string, className: string) => (
    <span
      className={classnames(styles.number, className, styles.sortable)}
      title={sortTitle}
      onClick={() => setSort(key)}
    >
      {sort === key ? `${text} ▾` : text}
    </span>
  );

  const routinesTab = () => (
    <>
      <div className={classnames(styles.row, styles.headerRow)}>
        <span className={styles.name}>{t("panels.doc.profiler.col.routine")}</span>
        {banked && <span className={styles.partition}>{t("panels.doc.profiler.col.partition")}</span>}
        <span className={styles.address}>{t("panels.doc.profiler.col.entry")}</span>
        {sortHeader("self", t("panels.doc.profiler.col.self", { unit }), t("panels.doc.profiler.sortBySelf"), "")}
        <span className={styles.share}>{t("panels.doc.profiler.col.selfPct")}</span>
        {model.flat.rows[0]?.callsFromGraph
          ? sortHeader("calls", t("panels.doc.profiler.col.calls"), t("panels.doc.profiler.sortByCalls"), styles.narrow)
          : sortHeader("calls", t("panels.doc.profiler.col.entries"), t("panels.doc.profiler.sortByEntries"), styles.narrow)}
        {sortHeader(
          "instructions",
          t("panels.doc.profiler.col.instructions"),
          t("panels.doc.profiler.sortByInstructions"),
          styles.narrow
        )}
        <span className={classnames(styles.number, styles.narrow)} title={t("panels.doc.profiler.col.perCallTitle")}>
          {t("panels.doc.profiler.col.perCall")}
        </span>
        <span className={styles.number} title={t("panels.doc.profiler.col.perFrameTitle")}>
          {t("panels.doc.profiler.col.perFrame")}
        </span>
        <span className={styles.source}>{t("panels.doc.profiler.col.source")}</span>
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
                    ? t("panels.doc.profiler.pseudoRowTitle")
                    : r.source === "labels"
                      ? t("panels.doc.profiler.labelRoutineTitle", { name: r.name, count: r.size ?? 0 })
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
        {banked && <span className={styles.partition}>{t("panels.doc.profiler.col.partition")}</span>}
        <span className={styles.address}>{t("panels.doc.profiler.col.address")}</span>
        <span className={styles.name}>{t("panels.doc.profiler.col.routine")}</span>
        <span className={styles.number}>{t("panels.doc.profiler.col.executions")}</span>
        <span className={styles.number}>{t("panels.doc.profiler.col.time", { unit })}</span>
        <span className={styles.share}>{t("panels.doc.profiler.col.timePct")}</span>
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
                title={r.halt ? t("panels.doc.profiler.haltTitle") : undefined}
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
    <EmptyState message={t("panels.doc.profiler.noGraph")} />
  );

  const treeColumns = (
    <div className={classnames(styles.row, styles.headerRow)}>
      <span className={styles.name}>{t("panels.doc.profiler.col.routine")}</span>
      <span className={classnames(styles.number, styles.narrow)}>{t("panels.doc.profiler.col.calls")}</span>
      <span className={styles.number} title={t("panels.doc.profiler.col.inclusiveTitle")}>
        {t("panels.doc.profiler.col.inclusive", { unit })}
      </span>
      <span className={styles.share}>{t("panels.doc.profiler.col.inclusivePct")}</span>
      <span className={styles.number} title={t("panels.doc.profiler.col.exclusiveTitle")}>
        {t("panels.doc.profiler.col.exclusive", { unit })}
      </span>
      <span className={styles.source}>{t("panels.doc.profiler.col.source")}</span>
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
      ? t("panels.doc.profiler.node.recursive", { name: node.name })
      : node.kind === "root"
        ? t("panels.doc.profiler.node.root")
        : node.kind === "interrupt"
          ? t("panels.doc.profiler.node.interrupt")
          : node.open
            ? t("panels.doc.profiler.node.open", { name: node.name })
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
      return <EmptyState message={t("panels.doc.profiler.selectRoutine")} />;
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
          {t("panels.doc.profiler.callersCaption", {
            name: subject.name,
            count: subject.calls,
            inclusive: formatTime(subject.inclusive, status),
            exclusive: formatTime(subject.exclusive, status)
          })}
        </div>
        {treeColumns}
        <div className={styles.list} style={{ overflow: "auto" }}>
          {list(t("panels.doc.profiler.calledBy", { count: callers.length }), callers)}
          {list(t("panels.doc.profiler.callsList", { count: callees.length }), callees)}
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
