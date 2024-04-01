import styles from "./ScriptingHistoryPanel.module.scss";
import { useEffect, useRef, useState } from "react";
import { VirtualizedListView } from "@renderer/controls/VirtualizedListView";
import { LabelSeparator } from "@renderer/controls/Labels";
import { Icon } from "@renderer/controls/Icon";
import classnames from "@renderer/utils/classnames";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import { useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "../services/AppServicesProvider";

const ScriptingHistoryPanel = () => {
  const { ideCommandsService } = useAppServices();
  const scripts = useSelector(state => state.scripts);
  const [selectedScript, setSelectedScript] = useState<ScriptRunInfo>();
  const [version, setVersion] = useState(1);
  const refreshing = useRef(false);
  
  useEffect(() => {
    (async() => {
      if (refreshing.current) return;
      refreshing.current = true;
      await new Promise(resolve => setTimeout(resolve, 250));
      setVersion(version + 1);
      refreshing.current = false;
    })()
  })

  return (
    <div className={styles.panel}>
      {scripts.length === 0 && (
        <div className={styles.center}>No scripts started</div>
      )}
      {scripts.length > 0 && (
        <VirtualizedListView
          items={scripts}
          approxSize={24}
          fixItemHeight={true}
          itemRenderer={idx => {
            const script = scripts[idx];
            console;
            let icon = "";
            let color = "";
            const from = script.startTime;
            let to = new Date();
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
                key = {1000 * version + idx}
                className={classnames(styles.itemWrapper, {
                  [styles.selected]: selectedScript?.id === script.id
                })}
                onClick={async () => {
                  setSelectedScript(script);
                  await ideCommandsService.executeCommand(
                    `script-output ${script.id}`
                  );
                }}
              >
                <LabelSeparator width={4} />
                <Icon
                  iconName={script.runsInEmu ? "vm" : "tools"}
                  fill='--color-command-icon'
                  width={16}
                  height={16}
                />
                <LabelSeparator width={4} />
                <Icon iconName={icon} fill={color} width={16} height={16} />
                <div className={styles.itemText}>{script.scriptFileName}</div>
                <div className={styles.itemTime}>{`${duration}ms`}</div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
};

export const scriptingHistoryPanelRenderer = () => <ScriptingHistoryPanel />;
