import type { ScriptRunInfo } from "@abstractions/ScriptRunInfo";

import styles from "./ScriptingHistoryPanel.module.scss";
import { useEffect, useMemo, useState } from "react";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Icon } from "@renderer/controls/Icon";
import classnames from "classnames";
import { useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { TabButton } from "@renderer/controls/TabButton";
import { isScriptCompleted, scriptDocumentId } from "@common/utils/script-utils";
import { Text } from "@renderer/controls/layout/Text";
import { useMainApi } from "@renderer/core/MainApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { EmptyState } from "@renderer/controls/data";

export const ScriptingHistoryPanel = () => {
  const { ideCommandsService, projectService } = useAppServices();
  const mainApi = useMainApi();
  const scriptsInState = useSelector((state) => state.scripts);
  const [scripts, setScripts] = useState<ScriptRunInfo[]>([]);
  const [selectedScript, setSelectedScript] = useState<ScriptRunInfo>();
  const [version, setVersion] = useState(1);
  const [showBuildScripts, setShowBuildScripts] = useState(true);

  useEffect(() => {
    setScripts(
      scriptsInState
        .filter(
          (script) => (script.specialScript !== "build" && !showBuildScripts) || showBuildScripts
        )
        .reverse()
    );
  }, [scriptsInState, showBuildScripts]);

  /*
   * Re-render only while a script is still running.
   *
   * The only thing this timer advances is the elapsed duration of a *pending* script — every other
   * status has a fixed `endTime`/`stopTime`, so once nothing is pending it was re-rendering the
   * whole virtualized list every five seconds, for ever, to recompute numbers that cannot change.
   */
  const hasPendingScript = scripts.some((script) => !isScriptCompleted(script.status));
  // --- One clock reading per panel render, handed down. A row must not call `new Date()` in its
  // --- own render: the same state would then draw differently twice.
  const now = useMemo(() => new Date(), [version, scripts]);

  useEffect(() => {
    if (!hasPendingScript) return undefined;
    const id = setInterval(() => setVersion((v) => v + 1), 5000);
    return () => clearInterval(id);
  }, [hasPendingScript]);

  return (
    /*
     * One wrapper, not three.
     *
     * `styles.panel` was applied to three nested divs, the outer two of which existed only to host
     * an `{scripts.length >= 0 && …}` guard — a condition that is true for every possible array,
     * including an empty one. That is why an empty history rendered the toolbar over a blank area
     * and never reached an empty state.
     */
    <div className={styles.panel}>
      <div className={styles.header}>
        <TabButton
          iconName="clear-all"
          title="Clear completed scripts"
          clicked={async () => {
            const removed = scripts.filter((scr) => isScriptCompleted(scr.status));
            const hub = projectService.getActiveDocumentHubService();
            removed.forEach(async (scr) => {
              await hub.closeDocument(scriptDocumentId(scr.id));
            });
            await mainApi.removeCompletedScripts();
          }}
        />
        <TabButton
          iconName="combine"
          title={`${showBuildScripts ? "Hide" : "Show"} build scripts`}
          fill={showBuildScripts ? "--color-button-focused" : undefined}
          clicked={() => {
            setShowBuildScripts(!showBuildScripts);
          }}
        />
        <Text text={`Scripts displayed: ${scripts.length}`} />
      </div>
      {scripts.length === 0 && (
        <EmptyState
          message={
            showBuildScripts
              ? "No scripts have run yet"
              : "No scripts have run yet, apart from build scripts"
          }
        />
      )}
      {scripts.length > 0 && (
        <div className={styles.listArea}>
          <VirtualizedList
            items={scripts}
            renderItem={(idx) => {
              const script = scripts[idx];
              if (!script) return null;
              return (
                <ScriptItem
                  script={script}
                  /*
                   * `now` is what the five-second timer actually feeds. It used to pass
                   * `itemKey={1000 * version + idx}`, which the row applied as `key` on its own
                   * returned element — where React ignores it — so the re-render hack did nothing
                   * and every pending duration was computed from a `new Date()` taken during
                   * render, differing between two renders of the same state.
                   */
                  now={now}
                  isSelected={selectedScript?.id === script.id}
                  onSelect={async () => {
                    setSelectedScript(script);
                    await ideCommandsService.executeCommand(`script-output ${script.id}`);
                  }}
                />
              );
            }}
          />
        </div>
      )}
    </div>
  );
};

type ScriptItemProps = {
  script: ScriptRunInfo;
  /** The panel's clock reading. See the note at the call site. */
  now: Date;
  isSelected: boolean;
  onSelect: () => Promise<void>;
};

const ScriptItem = ({ script, now, isSelected, onSelect }: ScriptItemProps) => {
  let icon = "";
  let color = "";
  const from = script.startTime;
  let to = now;

  // --- Set the task icon
  let taskIcon = script.runsInEmu ? "vm" : "tools";
  let taskIconColor = "--color-command-icon";
  let taskName = script.scriptFileName;
  if (script.specialScript === "build") {
    taskIcon = "combine";
    taskIconColor = "--data-label";
    taskName = "build";
    taskName = script.scriptFunction;
  }

  /*
   * Status colour comes from the app's `--status-*` family, not the console's ANSI palette.
   *
   * These five *are* genuinely status — running, succeeded, failed, stopped — so unlike the type
   * icons §5.2 stripped, they keep a colour. What changes is where it comes from: the ANSI palette
   * is the console's, it does not follow the accent, and four of its hues measure at or below 3:1
   * on the light tone. The build-script *type* icon went neutral for the other half of that rule —
   * a type is not state, and the glyph already says it.
   */
  switch (script.status) {
    case "pending":
      icon = "play";
      color = "--status-info";
      break;
    case "completed":
      icon = "check";
      color = "--status-success";
      to = script.endTime;
      break;
    case "execError":
      icon = "close";
      color = "--status-error";
      to = script.endTime;
      break;
    case "compileError":
      icon = "circle-slash";
      color = "--status-error";
      to = script.endTime;
      break;
    case "stopped":
      icon = "stop";
      color = "--status-warning";
      to = script.stopTime;
      break;
  }
  to ??= now;
  const duration = to.getTime() - from.getTime();
  return (
    <div
      className={classnames(styles.itemWrapper, {
        [styles.selected]: isSelected
      })}
      onClick={async () => await onSelect?.()}
    >
      <LabelSeparator />
      <Icon iconName={taskIcon} fill={taskIconColor} width={16} height={16} />
      <LabelSeparator />
      <Icon iconName={icon} fill={color} width={16} height={16} />
      <div className={styles.itemId}>{script.id}</div>
      <div className={styles.itemText}>{taskName}</div>
      <div className={styles.itemTime}>{`${duration}ms`}</div>
    </div>
  );
};
