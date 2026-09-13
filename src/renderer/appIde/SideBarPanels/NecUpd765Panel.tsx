import type { FloppyLogEntry } from "@abstractions/FloppyLogEntry";

import { useCallback, useRef, useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./NecUpd765Panel.module.scss";
import { toHexa2, toHexa4 } from "../services/ide-commands";
import { PortOperationType } from "@abstractions/FloppyLogEntry";
import { Icon } from "@renderer/controls/Icon";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { useEmuApi } from "@renderer/core/EmuApi";
import {
  DataLabel,
  DataRow,
  DataSecondary,
  DataValue,
  EmptyState
} from "@renderer/controls/data";
import { iconSizes } from "@renderer/theming/tokens/dimensions";

/**
 * The glyph for each port operation — and *only* the glyph.
 *
 * These four were drawn in three colours from the console's ANSI palette
 * (`--console-ansi-white`, `-bright-cyan`, `-bright-magenta`), which is the pattern §5.2 removed
 * from the app and that `WatchPanel` documents removing from itself: a saturated hue marking a
 * *type* is not state, and the glyph says it already.
 *
 * Except that here the glyph did not, which is why this is a redraw rather than a deletion. Reading
 * data and reading the main status register were the *same* left arrow, told apart by cyan versus
 * white — so stripping the colour would have merged two operations into one. The status read now
 * takes the circled arrow, and the four operations are four distinct marks in one neutral tone.
 *
 * A `default` is not optional. Without one an `opType` outside this enum left `icon` `undefined`
 * and reached `<Icon iconName={undefined}>`.
 */
const OPERATION_ICON: Record<PortOperationType, string> = {
  [PortOperationType.ReadData]: "arrow-small-left",
  [PortOperationType.ReadMsr]: "arrow-circle-left",
  [PortOperationType.WriteData]: "arrow-small-right",
  [PortOperationType.MotorEvent]: "gear"
};

/** The fallback for an operation this panel does not know about. */
const UNKNOWN_OPERATION_ICON = "question";

export const NecUpd765Panel = () => {
  const emuApi = useEmuApi();
  const [log, setLog] = useState<FloppyLogEntry[]>([]);
  const logLength = useRef(0);

  /*
   * The log is append-only, so its length is what says whether anything happened.
   *
   * This used to replace the whole array on every refresh tick — ~1.3 times a second, for as long
   * as the panel was open — so the virtualized list reconciled continuously while the floppy sat
   * idle. Comparing the length is enough: entries are never edited or removed, only added.
   *
   * `useCallback` because `useEmuStateListener` keys its subscription on the callback's identity.
   */
  const refreshLogEntries = useCallback(async () => {
    const entries = await emuApi.getNecUpd765State();
    if (entries.length === logLength.current) return;
    logLength.current = entries.length;
    setLog(entries);
  }, [emuApi]);

  useEmuStateListener(emuApi, refreshLogEntries);

  return (
    <div className={styles.necPanel}>
      {log.length === 0 && <EmptyState message="No log entries collected" />}
      {log.length > 0 && (
        <VirtualizedList
          items={log}
          renderItem={(idx) => {
            const item = log[idx];
            if (!item) return null;
            return (
              <DataRow hoverable>
                <Icon
                  iconName={OPERATION_ICON[item.opType] ?? UNKNOWN_OPERATION_ICON}
                  width={iconSizes.sm}
                  height={iconSizes.sm}
                  fill="--data-label"
                />
                <DataLabel text={toHexa4(item.addr)} xclass={styles.necAddress} />
                <DataValue text={toHexa2(item.data ?? 0)} xclass={styles.necData} />
                <DataLabel text={item.phase ?? " "} width="3ch" />
                <DataSecondary text={item.comment ?? ""} />
              </DataRow>
            );
          }}
        />
      )}
    </div>
  );
};
