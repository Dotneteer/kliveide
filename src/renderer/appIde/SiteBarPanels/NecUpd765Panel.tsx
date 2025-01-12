import type { FloppyLogEntry } from "@abstractions/FloppyLogEntry";

import { LabelSeparator, Label, Secondary, Value } from "@controls/Labels";
import { VirtualizedListView } from "@controls/VirtualizedListView";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { useState } from "react";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./NecUpd765Panel.module.scss";
import { toHexa2, toHexa4 } from "../services/ide-commands";
import { PortOperationType } from "@abstractions/FloppyLogEntry";
import { Icon } from "@renderer/controls/Icon";
import { createEmuAltApi } from "@common/messaging/EmuApiAlt";

const NecUpd765Panel = () => {
  const { messenger } = useRendererContext();
  const [log, setLog] = useState<FloppyLogEntry[]>([]);

  // --- This function queries the breakpoints from the emulator
  const refreshLogEntries = async () => {
    // --- Get breakpoint information
    const log = await createEmuAltApi(messenger).getNecUpd765State();
    // --- Store the breakpoint info
    setLog(log);
  };

  // --- Take care of refreshing the screen
  useStateRefresh(500, async () => {
    await refreshLogEntries();
  });

  return (
    <div className={styles.necPanel}>
      {log.length === 0 && <div className={styles.center}>No log entries collected </div>}
      {log.length > 0 && (
        <VirtualizedListView
          items={log}
          approxSize={20}
          fixItemHeight={true}
          itemRenderer={(idx) => {
            const item = log[idx];
            if (!item) return null;
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
                icon = "gear";
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
                <Value text={toHexa2(item.data ?? 0)} />
                <LabelSeparator width={8} />
                <Label text={item.phase ?? " "} width={16} />
                <Secondary text={item.comment ?? ""} />
              </div>
            );
          }}
        />
      )}
    </div>
  );
};

export const necUpd765PanelRenderer = () => <NecUpd765Panel />;
