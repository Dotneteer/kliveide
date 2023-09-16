import { LabelSeparator, Label, Secondary, Value } from "@controls/Labels";
import { VirtualizedListView } from "@controls/VirtualizedListView";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { useState } from "react";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./NecUpd765Panel.module.scss";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";
import { toHexa2, toHexa4 } from "../services/ide-commands";
import {
  FloppyLogEntry,
  PortOperationType
} from "@abstractions/FloppyLogEntry";
import { Icon } from "@renderer/controls/Icon";

const NecUpd765Panel = () => {
  const { messenger } = useRendererContext();
  const [log, setLog] = useState<FloppyLogEntry[]>([]);

  // --- This function queries the breakpoints from the emulator
  const refreshLogEntries = async () => {
    // --- Get breakpoint information
    const logResponse = await messenger.sendMessage({
      type: "EmuGetNecUpd765State"
    });
    if (logResponse.type === "ErrorResponse") {
      reportMessagingError(
        `EmuGetNecUpd765State call failed: ${logResponse.message}`
      );
    } else if (logResponse.type !== "EmuGetNecUpd765StateResponse") {
      reportUnexpectedMessageType(logResponse.type);
    } else {
      // --- Store the breakpoint info
      setLog(logResponse.log);
    }
  };

  // --- Take care of refreshing the screen
  useStateRefresh(500, async () => {
    await refreshLogEntries();
  });

  return (
    <div className={styles.necPanel}>
      {log.length === 0 && (
        <div className={styles.center}>No log entries collected </div>
      )}
      {log.length > 0 && (
        <VirtualizedListView
          items={log}
          approxSize={20}
          fixItemHeight={false}
          itemRenderer={idx => {
            const item = log[idx];
            let icon: string;
            let iconColor: string;
            switch (item.opType) {
              case PortOperationType.ReadData:
                icon = "arrow-small-left";
                iconColor = "--console-ansi-white";
                break;
              case PortOperationType.ReadMsr:
                icon = "arrow-small-left";
                iconColor = "--console-ansi-bright-cyan";
                break;
              case PortOperationType.WriteData:
                icon = "arrow-small-right";
                iconColor = "--console-ansi-bright-magenta";
                break;
              case PortOperationType.MotorEvent:
                icon = "settings-gear";
                iconColor = "--console-ansi-white";
                break;
            }
            return (
              <div className={styles.entry}>
                <LabelSeparator width={4} />
                <Icon iconName={icon} width={16} height={16} fill={iconColor} />
                <LabelSeparator width={8} />
                <Label text={toHexa4(item.addr)} />
                <LabelSeparator width={8} />
                <Value text={toHexa2(item.data)} />
                <LabelSeparator width={8} />
                <Label text={item.phase ?? " "} width={16} />
                <Secondary text={item.comment} />
              </div>
            );
          }}
        />
      )}
    </div>
  );
};

export const necUpd765PanelRenderer = () => <NecUpd765Panel />;
