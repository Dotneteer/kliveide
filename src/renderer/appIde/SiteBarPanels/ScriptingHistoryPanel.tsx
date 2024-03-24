import styles from "./ScriptingHistoryPanel.module.scss";
import { useState } from "react";
import { VirtualizedListView } from "@renderer/controls/VirtualizedListView";
import { LabelSeparator } from "@renderer/controls/Labels";
import { Icon } from "@renderer/controls/Icon";
import classnames from "@renderer/utils/classnames";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";

const fakeHistory: ScriptRunInfo[] = [
  {
    id: 1,
    scriptFileName: "Test0.ksx",
    status: "pending",
    startTime: new Date(),
    error: undefined
  },
  {
    id: 2,
    scriptFileName: "Test1.ksx",
    status: "completed",
    startTime: new Date("2021-07-01T12:00:00"),
    endTime: new Date("2021-07-01T12:00:03"),
    error: undefined
  },
  {
    id: 3,
    scriptFileName: "Test2.ksx",
    status: "running",
    startTime: new Date(),
    endTime: undefined,
    error: undefined
  },
  {
    id: 4,
    scriptFileName: "Test3.ksx",
    status: "execError",
    startTime: new Date("2021-07-01T12:00:00"),
    endTime: new Date("2021-07-01T12:00:03"),
    error: "Execution Error"
  },
  {
    id: 5,
    scriptFileName: "Test4.ksx",
    status: "compileError",
    startTime: new Date("2021-07-01T12:00:00"),
    endTime: new Date("2021-07-01T12:00:03"),
    error: "Compile Error"
  },
  {
    id: 6,
    scriptFileName: "Test5.ksx",
    status: "stopped",
    startTime: new Date("2021-07-01T12:00:00"),
    stopTime: new Date("2021-07-01T12:00:03"),
    error: undefined
  }
];

const ScriptingHistoryPanel = () => {
  const [history, setHistory] = useState<ScriptRunInfo[]>(fakeHistory);
  const [selectedScript, setSelectedScript] = useState<ScriptRunInfo>();
  return (
    <div className={styles.panel}>
      {history.length === 0 && (
        <div className={styles.center}>No scripts started</div>
      )}
      {history.length > 0 && (
        <VirtualizedListView
          items={history}
          approxSize={24}
          fixItemHeight={true}
          itemRenderer={idx => {
            const script = history[idx];
            let icon = "";
            let color = "";
            const from = script.startTime;
            let to = new Date();
            switch (script.status) {
              case "pending":
                icon = "pause";
                color = "--console-default";
                break;
              case "completed":
                icon = "check";
                color = "--console-ansi-bright-green";
                to = script.endTime;
                break;
              case "running":
                icon = "play";
                color = "--console-ansi-bright-blue";
                break;
              case "execError":
                icon = "close";
                color = "--console-ansi-bright-red";
                to = script.endTime;
                break;
              case "compileError":
                icon = "close";
                color = "--console-ansi-bright-red";
                to = script.endTime;
                break;
              case "stopped":
                icon = "circle-slash";
                color = "--console-ansi-bright-red";
                to = script.stopTime;
                break;
            }
            to ??= new Date();
            const duration = to.getTime() - from.getTime();
            return (
              <div
                className={classnames(styles.itemWrapper, {
                  [styles.selected]: selectedScript?.id === script.id
                })}
                onClick={() => setSelectedScript(script)}
              >
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
