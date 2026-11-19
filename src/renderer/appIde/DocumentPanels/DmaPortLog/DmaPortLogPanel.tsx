import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";

import { describeDmaCommand, formatDmaCommand } from "@common/zxnext/dma/dmaDecoder";
import {
  buildDmaLogEntries,
  decodeDmaLog,
  dmaLogFrameT,
  type DmaLogAnomaly,
  type DmaLogEntry,
  type DmaLogRecord,
  type DmaLogRow,
  type DmaLogSetup
} from "@common/zxnext/dma/dmaLog";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";
import { SmallIconButton } from "@controls/IconButton";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { EmptyState, PanelHeader, PanelHeaderGroup } from "@renderer/controls/data";
import { FullPanel } from "@renderer/controls/layout/Panels";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useEmuStateListener } from "../../useStateRefresh";
import styles from "./DmaPortLogPanel.module.scss";

/**
 * The DMA Port Log document (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §11.3): every access to ports $6B
 * and $0B as the DMA took it, grouped into setups, with each command decoded from the bytes the
 * sequencer actually took. Opening it switches the core's ring on; closing it switches it off.
 */

/** The table shows at most this many rows, the newest */
const ROW_CAP = 1000;

type Filter = "all" | "writes" | "reads" | "anomalies";

const ANOMALY_KEYS: Record<DmaLogAnomaly, MessageKey> = {
  deaf: "panels.doc.dmaLog.anomaly.deaf",
  becomesDeaf: "panels.doc.dmaLog.anomaly.becomesDeaf",
  ignored: "panels.doc.dmaLog.anomaly.ignored",
  enableWithoutLoad: "panels.doc.dmaLog.anomaly.enableWithoutLoad",
  ddmaOn0B: "panels.doc.dmaLog.anomaly.ddmaOn0B"
};

const FILTER_KEYS: Record<Filter, MessageKey> = {
  all: "panels.doc.dmaLog.filter.all",
  writes: "panels.doc.dmaLog.filter.writes",
  reads: "panels.doc.dmaLog.filter.reads",
  anomalies: "panels.doc.dmaLog.filter.anomalies"
};

/** The read entries and follow-byte roles as the table shows them: hardware terms, not translated */
const READ_ENTRY_TEXT: Record<string, string> = {
  status: "status",
  counterLo: "counter low",
  counterHi: "counter high",
  portALo: "port A low",
  portAHi: "port A high",
  portBLo: "port B low",
  portBHi: "port B high"
};
const FIELD_TEXT: Record<string, string> = {
  portA: "port A",
  portALo: "port A low",
  portAHi: "port A high",
  length: "block length",
  lengthLo: "length low",
  lengthHi: "length high",
  portB: "port B",
  portBLo: "port B low",
  portBHi: "port B high",
  timing: "timing",
  timingExtra: "ignored (port A has no prescaler)",
  prescaler: "prescaler",
  mask: "mask (ignored)",
  match: "match (ignored)",
  readMask: "read mask",
  ddma: "zxnDDMA value"
};

const fmt = (n: number) => Math.round(n).toLocaleString("en");
const hex2 = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

/** What a row's meaning column says (hardware text from the decoder, as the disassembly shows it) */
function meaningOf(row: DmaLogRow): string {
  if (row.kind === "read") {
    const entry = READ_ENTRY_TEXT[row.entry];
    if (row.entry !== "status") return entry;
    const ended = (row.record.value & 0x20) === 0;
    const moving = (row.record.value & 0x01) !== 0;
    return `${entry}: ${ended ? "end of block reached" : "block not finished"}${moving ? ", transfer under way" : ""}`;
  }
  if (row.role === "ignored") return "";
  if (row.role === "follow") return FIELD_TEXT[row.field ?? ""] ?? "";
  if (row.ddma) return row.ddma;
  return row.command ? describeDmaCommand(row.command).replace(/^WR\d: /, "") : "";
}

const rowHasAnomaly = (row: DmaLogRow) => row.anomalies.length > 0;

function passes(filter: Filter, entry: DmaLogEntry): boolean {
  if (entry.type === "setup") return filter === "all" || filter === "writes";
  const row = entry.row;
  switch (filter) {
    case "writes":
      return row.kind === "write";
    case "reads":
      return row.kind === "read";
    case "anomalies":
      return rowHasAnomaly(row);
    default:
      return true;
  }
}

const DmaPortLogPanel = (_props: DocumentProps) => {
  const t = useT();
  const emuApi = useEmuApi();
  const { ideCommandsService } = useAppServices();

  const [recording, setRecording] = useState(true);
  const recordingRef = useRef(true);
  const recordsRef = useRef<DmaLogRecord[]>([]);
  const countRef = useRef(0);
  const [version, setVersion] = useState(0);
  const [meta, setMeta] = useState<{ count: number; capacity: number }>();
  const [unavailable, setUnavailable] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [grouped, setGrouped] = useState(true);
  const [copied, setCopied] = useState<number>();

  // --- Incremental reads: only the records written since the last one (or all, after a clear)
  const refresh = useCallback(async () => {
    try {
      if (recordingRef.current) await emuApi.setDmaLogRecording(true);
      let since = countRef.current;
      let log = await emuApi.getDmaLog(since);
      if (log.count < since) {
        // --- Cleared, or a new machine: start over
        recordsRef.current = [];
        since = 0;
        log = await emuApi.getDmaLog(0);
      }
      const fresh = decodeDmaLog(log);
      if (fresh.length > 0) {
        const all = recordsRef.current.concat(fresh);
        recordsRef.current = all.length > log.capacity ? all.slice(all.length - log.capacity) : all;
      }
      countRef.current = log.count;
      setMeta({ count: log.count, capacity: log.capacity });
      setUnavailable(false);
      setVersion((v) => v + 1);
    } catch {
      setUnavailable(true);
    }
  }, [emuApi]);
  useEmuStateListener(emuApi, refresh);

  // --- The ring records while the document is open (§11.1)
  useEffect(() => {
    void emuApi.setDmaLogRecording(true).catch(() => undefined);
    return () => {
      void emuApi.setDmaLogRecording(false).catch(() => undefined);
    };
  }, [emuApi]);

  const toggleRecording = async (on: boolean) => {
    recordingRef.current = on;
    setRecording(on);
    await emuApi.setDmaLogRecording(on);
  };
  const clear = async () => {
    await emuApi.clearDmaLog();
    recordsRef.current = [];
    countRef.current = 0;
    await refresh();
  };

  const entries = useMemo(
    () => buildDmaLogEntries(recordsRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );
  const shown = useMemo(() => {
    const list = entries.filter((e) => passes(filter, e) && (grouped || e.type === "row"));
    return list.length > ROW_CAP ? { rows: list.slice(list.length - ROW_CAP), hidden: list.length - ROW_CAP } : { rows: list, hidden: 0 };
  }, [entries, filter, grouped]);
  const anomalyCount = useMemo(() => entries.filter((e) => e.type === "row" && rowHasAnomaly(e.row)).length, [entries]);

  if (unavailable) {
    return (
      <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
        <EmptyState message={t("panels.doc.dmaLog.notAvailable")} />
      </FullPanel>
    );
  }

  const reveal = (pc: number) => void ideCommandsService.executeCommand(`show-disass ${hex4(pc)}`);
  const copySetup = async (setup: DmaLogSetup) => {
    const text = setup.commands.map((c) => formatDmaCommand(c).text).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(setup.index);
    } catch {
      setCopied(undefined);
    }
  };

  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      <PanelHeader>
        <PanelHeaderGroup>
          <LabeledSwitch
            value={recording}
            label={t("panels.doc.dmaLog.record")}
            title={t("panels.doc.dmaLog.recordTitle")}
            clicked={(v: boolean) => void toggleRecording(v)}
          />
          <SmallIconButton iconName="trash" title={t("panels.doc.dmaLog.clear")} clicked={() => void clear()} />
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <span className={styles.segmented} role="group" title={t("panels.doc.dmaLog.filterTitle")}>
            {(Object.keys(FILTER_KEYS) as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={classnames(styles.segment, { [styles.segmentOn]: f === filter })}
                aria-pressed={f === filter}
                onClick={() => setFilter(f)}
              >
                {f === "anomalies" ? t(FILTER_KEYS[f], { count: anomalyCount }) : t(FILTER_KEYS[f])}
              </button>
            ))}
          </span>
          <LabeledSwitch
            value={grouped}
            label={t("panels.doc.dmaLog.group")}
            title={t("panels.doc.dmaLog.groupTitle")}
            clicked={(v: boolean) => setGrouped(v)}
          />
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <span className={classnames(styles.held, { [styles.full]: !!meta && meta.count > meta.capacity })}>
            {meta
              ? t("panels.doc.dmaLog.held", { used: Math.min(meta.count, meta.capacity), capacity: meta.capacity })
              : ""}
          </span>
        </PanelHeaderGroup>
      </PanelHeader>

      {shown.rows.length === 0 ? (
        <EmptyState message={recording ? t("panels.doc.dmaLog.waiting") : t("panels.doc.dmaLog.paused")} />
      ) : (
        <div className={styles.body}>
          <ScrollViewer>
            {shown.hidden > 0 && <div className={styles.muted}>{t("panels.doc.dmaLog.olderHidden", { count: shown.hidden })}</div>}
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("panels.doc.dmaLog.col.frame")}</th>
                  <th>{t("panels.doc.dmaLog.col.tState")}</th>
                  <th>PC</th>
                  <th>{t("panels.doc.dmaLog.col.port")}</th>
                  <th>{t("panels.doc.dmaLog.col.byte")}</th>
                  <th>{t("panels.doc.dmaLog.col.group")}</th>
                  <th>{t("panels.doc.dmaLog.col.meaning")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.rows.map((entry) =>
                  entry.type === "setup" ? (
                    <tr key={`s${entry.setup.index}-${entry.setup.first.seq}`} className={styles.setupRow}>
                      <td colSpan={7}>
                        <span className={styles.setupTitle}>
                          {t("panels.doc.dmaLog.setup", { index: entry.setup.index, count: entry.setup.writes })}
                        </span>
                        <span className={styles.setupDetail}>
                          {entry.setup.first.host
                            ? t("panels.doc.dmaLog.setupHost", { port: entry.setup.first.port0B ? "$0B" : "$6B" })
                            : t("panels.doc.dmaLog.setupFrom", {
                                pc: hex4(entry.setup.first.pc),
                                port: entry.setup.first.port0B ? "$0B" : "$6B"
                              })}
                          {" · "}
                          {entry.setup.enables ? t("panels.doc.dmaLog.setupEnables") : t("panels.doc.dmaLog.setupOpen")}
                        </span>
                        {entry.setup.commands.length > 0 && (
                          <button type="button" className={styles.link} onClick={() => void copySetup(entry.setup)}>
                            {copied === entry.setup.index ? t("panels.doc.dmaLog.copied") : t("panels.doc.dmaLog.copy")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    <LogRow key={entry.row.record.seq} row={entry.row} onReveal={reveal} />
                  )
                )}
              </tbody>
            </table>
          </ScrollViewer>
        </div>
      )}
    </FullPanel>
  );
};

const LogRow = ({ row, onReveal }: { row: DmaLogRow; onReveal: (pc: number) => void }) => {
  const t = useT();
  const r = row.record;
  const isBase = row.kind === "write" && row.role === "base";
  const isFollow = row.kind === "write" && row.role === "follow";
  return (
    <tr className={classnames({ [styles.anomaly]: row.anomalies.length > 0, [styles.followRow]: isFollow })}>
      <td>{fmt(r.frame)}</td>
      <td>{fmt(dmaLogFrameT(r))}</td>
      <td>
        {r.host ? (
          <span className={styles.secondary}>{t("panels.doc.dmaLog.host")}</span>
        ) : (
          <button type="button" className={styles.pc} title={t("panels.doc.dmaLog.pcTitle")} onClick={() => onReveal(r.pc)}>
            {hex4(r.pc)}
          </button>
        )}
      </td>
      <td>{`${row.kind === "read" ? "IN" : "OUT"} ${r.port0B ? "$0B" : "$6B"}`}</td>
      <td className={classnames({ [styles.baseByte]: isBase, [styles.readByte]: row.kind === "read" })}>{hex2(r.value)}</td>
      <td className={styles.secondary}>{row.kind === "write" && row.role !== "follow" ? (row.group ?? "") : ""}</td>
      <td className={styles.meaning}>
        {meaningOf(row)}
        {row.anomalies.map((a) => (
          <span key={a} className={styles.anomalyText}>
            {t(ANOMALY_KEYS[a])}
          </span>
        ))}
      </td>
    </tr>
  );
};

export const createDmaPortLogPanel = ({ document, viewState }: DocumentProps) => (
  <DmaPortLogPanel document={document} viewState={viewState} />
);
