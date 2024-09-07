import type { ScriptRunInfo } from "@abstractions/ScriptRunInfo";

import styles from "./ScriptingHistoryPanel.module.scss";
import { useEffect, useRef, useState } from "react";
import { VirtualizedListView } from "@renderer/controls/VirtualizedListView";
import { LabelSeparator } from "@renderer/controls/Labels";
import { Icon } from "@renderer/controls/Icon";
import classnames from "@renderer/utils/classnames";
import { useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "../services/AppServicesProvider";
import { TabButton } from "@renderer/controls/TabButton";
import { isScriptCompleted, scriptDocumentId } from "@common/utils/script-utils";
import { Text } from "@renderer/controls/generic/Text";
import { useMainApi } from "@renderer/core/MainApi";
import { TooltipFactory } from "@renderer/controls/Tooltip";
import { initial } from "lodash";

const ScriptingHistoryPanel = () => {
  const { ideCommandsService, projectService } = useAppServices();
  const mainApi = useMainApi();
  const scriptsInState = useSelector((state) => state.scripts);
  const [scripts, setScripts] = useState<ScriptRunInfo[]>([]);
  const [selectedScript, setSelectedScript] = useState<ScriptRunInfo>();
  const [version, setVersion] = useState(1);
  const [showBuildScripts, setShowBuildScripts] = useState(true);
  const refreshing = useRef(false);

  useEffect(() => {
    setScripts(
      scriptsInState
        .filter(
          (script) => (script.specialScript !== "build" && !showBuildScripts) || showBuildScripts
        )
        .reverse()
    );
  }, [scriptsInState, showBuildScripts]);

  // --- Refresh script information regularly
  useEffect(() => {
    (async () => {
      if (refreshing.current) return;
      refreshing.current = true;
      await new Promise((resolve) => setTimeout(resolve, 5000));
      setVersion(version + 1);
      refreshing.current = false;
    })();
  });

  return (
    <div className={styles.panel}>
      {scripts.length >= 0 && (
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
          <div className={styles.panel}>
            <VirtualizedListView
              items={scripts}
              approxSize={24}
              fixItemHeight={true}
              itemRenderer={(idx) => {
                const script = scripts[idx];
                return (
                  <ScriptItem
                    script={script}
                    itemKey={1000 * version + idx}
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
        </div>
      )}
    </div>
  );
};

type ScriptItemProps = {
  script: ScriptRunInfo;
  itemKey: number;
  isSelected: boolean;
  onSelect: () => Promise<void>;
};

const ScriptItem = ({ script, itemKey, isSelected, onSelect }: ScriptItemProps) => {
  const [initialized, setInitialized] = useState(false);
  let icon = "";
  let color = "";
  const from = script.startTime;
  let to = new Date();

  useEffect(() => {
    setInitialized(true);
  }, [initialized]);

  // --- Set the task icon
  let taskIcon = script.runsInEmu ? "vm" : "tools";
  let taskIconColor = "--color-command-icon";
  let taskName = script.scriptFileName;
  if (script.specialScript === "build") {
    taskIcon = "combine";
    taskIconColor = "--console-ansi-bright-cyan";
    taskName = "build";
    taskName = script.scriptFunction;
  }

  // --- Set the status icon
  switch (script.status) {
    case "pending":
      icon = "play";
      color = "--console-ansi-bright-cyan";
      break;
    case "completed":
      icon = "check";
      color = "--console-ansi-bright-green";
      to = script.endTime;
      break;
    case "execError":
      icon = "close";
      color = "--console-ansi-bright-red";
      to = script.endTime;
      break;
    case "compileError":
      icon = "circle-slash";
      color = "--console-ansi-bright-red";
      to = script.endTime;
      break;
    case "stopped":
      icon = "stop";
      color = "--console-ansi-yellow";
      to = script.stopTime;
      break;
  }
  to ??= new Date();
  const duration = to.getTime() - from.getTime();
  return (
    <div
      key={itemKey}
      className={classnames(styles.itemWrapper, {
        [styles.selected]: isSelected
      })}
      onClick={async () => await onSelect?.()}
    >
      <LabelSeparator width={4} />
      <Icon iconName={taskIcon} fill={taskIconColor} width={16} height={16} />
      <LabelSeparator width={4} />
      <Icon iconName={icon} fill={color} width={16} height={16} />
      <div className={styles.itemId}>{script.id}</div>
      <div className={styles.itemText}>{taskName}</div>
      <div className={styles.itemTime}>{`${duration}ms`}</div>
    </div>
  );
};

export const scriptingHistoryPanelRenderer = () => <ScriptingHistoryPanel />;
