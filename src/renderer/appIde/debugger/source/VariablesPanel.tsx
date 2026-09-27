import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type { SourceActivationInfo, SourceStopInfo } from "@abstractions/SourceDebugInfo";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { addBasicWatchAction, removeBasicWatchAction } from "@common/state/actions";
import { hasSourceLevelDebug } from "@renderer/appIde/utils/compiler-utils";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { DataLabel, DataPanel, DataRow, DataSecondary, DataValue, EmptyState, SectionHeader } from "@renderer/controls/data";
import dataStyles from "@renderer/controls/data/Data.module.scss";
import { Icon } from "@renderer/controls/Icon";
import { IconButton } from "@renderer/controls/IconButton";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { iconSizes } from "@renderer/theming/tokens/dimensions";

import { buildSourceCallStack } from "./call-stack-model";
import { memoryView, type MemoryView } from "./value-decoder";
import { buildVariableSections, type VariableNode } from "./variables-model";
import { evaluateWatch } from "./watch-expression";
import styles from "./VariablesPanel.module.scss";

type Snapshot = { chain: SourceActivationInfo[]; stop?: SourceStopInfo; mem: MemoryView };

/**
 * The Variables panel of a Klive BASIC program (plan §10.7, §10.8): the FUNCTION results of the
 * last step, the parameters and locals of the frame selected in the Call Stack panel, the globals,
 * and the user's BASIC watch expressions — all decoded by type from a snapshot of memory taken
 * when the machine stops.
 */
export const VariablesPanel = () => {
  const result = useSelector((s) => s.compilation?.result);
  if (!hasSourceLevelDebug(result)) {
    return <EmptyState message="Build a Klive BASIC program to see its variables" />;
  }
  return <SourceVariables info={result.sourceLevelDebug} />;
};

const SourceVariables = ({ info }: { info: SourceLevelDebugInfo }) => {
  const emuApi = useEmuApi();
  const dispatch = useDispatch();
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const frame = useSelector((s) => s.ideView?.sourceFrame ?? 0);
  const watches = useSelector((s) => s.basicWatches);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState("");

  const refresh = useCallback(async () => {
    if (machineState !== MachineControllerState.Paused) {
      setSnapshot(undefined);
      return;
    }
    const [chain, stop, memory] = await Promise.all([
      emuApi.getSourceCallStack(),
      emuApi.getSourceStopInfo(),
      emuApi.getMemoryContents()
    ]);
    setSnapshot(chain ? { chain, stop, mem: memoryView(memory.memory) } : undefined);
  }, [emuApi, machineState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEmuStateListener(emuApi, refresh);

  const sections = useMemo(
    () => (snapshot ? buildVariableSections(info, snapshot.chain, frame, snapshot.stop, snapshot.mem) : undefined),
    [info, snapshot, frame]
  );
  const frameName = useMemo(() => {
    if (!snapshot) return "";
    const row = buildSourceCallStack(info, snapshot.chain, snapshot.stop).find((r) => !("runtime" in r) && r.frame === frame);
    return row && !("runtime" in row) ? row.name : "";
  }, [info, snapshot, frame]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addWatch = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !draft.trim()) return;
    dispatch(addBasicWatchAction(draft.trim()));
    setDraft("");
  };

  const renderNodes = (nodes: VariableNode[], depth: number) =>
    nodes.map((node) => {
      const open = expanded.has(node.id);
      return (
        <div key={node.id}>
          <DataRow hoverable clicked={node.expand ? () => toggle(node.id) : undefined}>
            <span className={styles.indent} style={{ inlineSize: `calc(var(--space-3) * ${depth})` }} />
            <span className={styles.expander}>
              {node.expand && (
                <Icon
                  iconName={open ? "chevron-down" : "chevron-right"}
                  width={iconSizes.sm}
                  height={iconSizes.sm}
                  fill="--data-label"
                />
              )}
            </span>
            <DataLabel text={node.name} />
            <DataValue
              text={node.value}
              xclass={styles.value}
              {...(node.address !== undefined ? { title: `At $${toHexa4(node.address)} (${node.address})` } : {})}
            />
            {node.type && <DataSecondary text={node.type} />}
          </DataRow>
          {open && node.expand && renderNodes(node.expand(), depth + 1)}
        </div>
      );
    });

  const ctx = snapshot ? { info, chain: snapshot.chain, frame, mem: snapshot.mem } : undefined;

  return (
    <DataPanel xclass={styles.variablesPanel}>
      {!sections && <EmptyState message="Pause the machine to see variables" />}
      {sections && sections.returned.length > 0 && (
        <>
          <SectionHeader title="Returned" />
          {renderNodes(sections.returned, 0)}
        </>
      )}
      {sections?.locals && (
        <>
          <SectionHeader title={`Locals — ${frameName}`} />
          {sections.localsNote && <EmptyState message={sections.localsNote} motif={false} />}
          {renderNodes(sections.locals, 0)}
        </>
      )}
      {sections && (
        <>
          <SectionHeader title="Globals" />
          {sections.globals.length ? renderNodes(sections.globals, 0) : <EmptyState message="No globals" motif={false} />}
        </>
      )}
      <SectionHeader title="Watch" />
      {(watches ?? []).map((text, i) => {
        const r = ctx ? evaluateWatch(text, ctx) : undefined;
        return (
          <DataRow key={`${i}:${text}`} hoverable>
            <span className={styles.expander} />
            <DataLabel text={text} />
            <DataValue
              text={!r ? "" : "error" in r ? r.error : r.text}
              xclass={r && "error" in r ? styles.watchError : styles.value}
            />
            {r && !("error" in r) && r.type && <DataSecondary text={r.type} />}
            <span className={styles.rowAction}>
              <IconButton
                iconName="trash"
                iconSize={14}
                buttonWidth={16}
                buttonHeight={16}
                noPadding
                title="Remove this watch"
                clicked={() => dispatch(removeBasicWatchAction(i))}
              />
            </span>
          </DataRow>
        );
      })}
      <div className={dataStyles.panelFilter}>
        <Icon iconName="plus" width={iconSizes.sm} height={iconSizes.sm} fill="--data-label" />
        <input
          className={dataStyles.panelFilterInput}
          type="text"
          aria-label="Add a BASIC watch expression"
          placeholder="Add watch: a BASIC expression"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={addWatch}
        />
      </div>
    </DataPanel>
  );
};
