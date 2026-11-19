import { useCallback, useEffect, useRef, useState } from "react";
import classnames from "classnames";

import { DMA_TRANSFERS_PANEL_ID } from "@common/state/common-ids";
import {
  blockBytes,
  DDMA_2D,
  DDMA_FILL,
  DDMA_PHYSICAL,
  DDMA_TRANSPARENT,
  decodeDmaTransfers,
  memoryOverlayOf,
  transferDestination,
  transferSource,
  xferClocksToT,
  type DmaSide,
  type DmaTransfer,
  type DmaTransferEnd
} from "@common/zxnext/dma/dmaTransfers";
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
import {
  dmaWorking,
  getDmaOverlaySelection,
  setDmaOverlaySelection,
  useDmaOverlaySelection
} from "@renderer/features/dma/dmaOverlayStore";
import { useEmuStateListener } from "../../useStateRefresh";
import styles from "./DmaTransfersPanel.module.scss";

/**
 * The DMA Transfers document (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §14.2): one row per transfer, from
 * its enable to its end; selecting a row tints its source and destination in the Memory panel. Opening
 * it switches the core's ring on; closing it switches it off (and drops the overlay).
 */

const END_KEYS: Record<DmaTransferEnd, MessageKey> = {
  running: "panels.doc.dmaXfer.end.running",
  endOfBlock: "panels.doc.dmaXfer.end.done",
  disabled: "panels.doc.dmaXfer.end.disabled",
  reset: "panels.doc.dmaXfer.end.reset",
  machineReset: "panels.doc.dmaXfer.end.machineReset",
  stopped: "panels.doc.dmaXfer.end.stopped"
};

const fmt = (n: number) => Math.round(n).toLocaleString("en");
const hex2 = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
const hex6 = (v: number) => `$${(v & 0xffffff).toString(16).toUpperCase().padStart(6, "0")}`;

/** The mode column: hardware terms, as the DMA panel and the Port Log show them */
function modeText(x: DmaTransfer): string {
  const parts: string[] = [];
  if (x.ddma.flags & (DDMA_PHYSICAL | DDMA_2D | DDMA_FILL | DDMA_TRANSPARENT)) {
    const ddma = ["zxnDDMA"];
    if (x.ddma.flags & DDMA_FILL) ddma.push("fill");
    if (x.ddma.flags & DDMA_2D) ddma.push("2D");
    if (x.ddma.flags & DDMA_PHYSICAL) ddma.push("physical");
    if (x.ddma.flags & DDMA_TRANSPARENT) ddma.push("transparent");
    parts.push(ddma.join(" "));
  }
  parts.push(x.prescaler > 0 ? `${x.mode} P ${x.prescaler}` : x.mode);
  if (x.zilog) parts.push("Z80 DMA");
  return parts.join(" · ");
}

/** A side's text: its ranges (two at most, then a count), its port or the fill value */
function sideText(side: DmaSide): string {
  switch (side.kind) {
    case "port":
      return `port ${hex2(side.port)}`;
    case "fill":
      return `value ${hex2(side.value)}`;
    default: {
      const h = side.physical ? hex6 : hex4;
      const text = side.ranges
        .slice(0, 2)
        .map((r) => (r.from === r.to ? h(r.from) : `${h(r.from)}–${h(r.to)}`))
        .join(", ");
      return side.ranges.length > 2 ? `${text} …` : text;
    }
  }
}

const DmaTransfersPanel = (_props: DocumentProps) => {
  const t = useT();
  const emuApi = useEmuApi();
  const { ideCommandsService, projectService } = useAppServices();
  const selected = useDmaOverlaySelection();

  const [recording, setRecording] = useState(true);
  const recordingRef = useRef(true);
  const [transfers, setTransfers] = useState<DmaTransfer[]>([]);
  const [meta, setMeta] = useState<{ count: number; capacity: number }>();
  const [unavailable, setUnavailable] = useState(false);

  // --- The ring holds 1,024 records of which the newest may still change: read them all each time
  const refresh = useCallback(async () => {
    try {
      if (recordingRef.current) await emuApi.setDmaTransfersRecording(true);
      const ring = await emuApi.getDmaTransfers();
      setTransfers(decodeDmaTransfers(ring));
      setMeta({ count: ring.count, capacity: ring.capacity });
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    }
  }, [emuApi]);
  useEmuStateListener(emuApi, refresh);

  /*
   * The ring records while the document is open (§14.1). A document is unmounted when another tab is
   * shown, too, so the recording (and the overlay) stop only when it is really closed - or, while no
   * row is selected, when it is hidden, like the other DMA documents.
   */
  useEffect(() => {
    void emuApi.setDmaTransfersRecording(true).catch(() => undefined);
    return () => {
      setTimeout(() => {
        const open = projectService.getActiveDocumentHubService().isOpen(DMA_TRANSFERS_PANEL_ID);
        if (!open) setDmaOverlaySelection(undefined);
        if (!open || getDmaOverlaySelection() === undefined) {
          void emuApi.setDmaTransfersRecording(false).catch(() => undefined);
        }
      }, 0);
    };
  }, [emuApi, projectService]);

  const toggleRecording = async (on: boolean) => {
    recordingRef.current = on;
    setRecording(on);
    await emuApi.setDmaTransfersRecording(on);
  };
  const clear = async () => {
    setDmaOverlaySelection(undefined);
    await emuApi.clearDmaTransfers();
    await refresh();
  };

  if (unavailable) {
    return (
      <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
        <EmptyState message={t("panels.doc.dmaXfer.notAvailable")} />
      </FullPanel>
    );
  }

  const reveal = (pc: number) => void ideCommandsService.executeCommand(`show-disass ${hex4(pc)}`);
  /*
   * A finished transfer is shown from its first byte; a running one a few rows before its next byte (not
   * at it: the cursor's outline would hide the next byte's frame), from the start of its range at most
   */
  const showInMemory = async (x: DmaTransfer) => {
    setDmaOverlaySelection(x.seq);
    const overlay = memoryOverlayOf(x, x.end === "running" ? await dmaWorking(emuApi).catch(() => undefined) : undefined);
    const next = overlay.nextWrite ?? overlay.nextRead;
    const ranges = overlay.nextWrite !== undefined ? overlay.written : overlay.read;
    const around = ranges.find((r) => next !== undefined && next >= r.from && next <= r.to + 1);
    const at =
      next !== undefined
        ? Math.max(around?.from ?? next, (next & 0xfff0) - 0x40)
        : (overlay.written[0]?.from ?? overlay.read[0]?.from);
    void ideCommandsService.executeCommand(at === undefined ? "show-memory" : `show-memory ${hex4(at)}`);
  };
  const select = (x: DmaTransfer) => setDmaOverlaySelection(selected === x.seq ? undefined : x.seq);

  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      <PanelHeader>
        <PanelHeaderGroup>
          <LabeledSwitch
            value={recording}
            label={t("panels.doc.dmaXfer.record")}
            title={t("panels.doc.dmaXfer.recordTitle")}
            clicked={(v: boolean) => void toggleRecording(v)}
          />
          <SmallIconButton iconName="trash" title={t("panels.doc.dmaXfer.clear")} clicked={() => void clear()} />
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <span className={styles.held}>{t("panels.doc.dmaXfer.selectHint")}</span>
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <span className={classnames(styles.held, { [styles.full]: !!meta && meta.count > meta.capacity })}>
            {meta ? t("panels.doc.dmaXfer.held", { used: Math.min(meta.count, meta.capacity), capacity: meta.capacity }) : ""}
          </span>
        </PanelHeaderGroup>
      </PanelHeader>

      {transfers.length === 0 ? (
        <EmptyState message={recording ? t("panels.doc.dmaXfer.waiting") : t("panels.doc.dmaXfer.paused")} />
      ) : (
        <div className={styles.body}>
          <ScrollViewer>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("panels.doc.dmaXfer.col.frame")}</th>
                  <th>{t("panels.doc.dmaXfer.col.startedBy")}</th>
                  <th>{t("panels.doc.dmaXfer.col.mode")}</th>
                  <th>{t("panels.doc.dmaXfer.col.from")}</th>
                  <th>{t("panels.doc.dmaXfer.col.to")}</th>
                  <th className={styles.num}>{t("panels.doc.dmaXfer.col.bytes")}</th>
                  <th className={styles.num}>{t("panels.doc.dmaXfer.col.busHeld")}</th>
                  <th>{t("panels.doc.dmaXfer.col.result")}</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((x) => (
                  <TransferRow
                    key={x.seq}
                    x={x}
                    selected={x.seq === selected}
                    onSelect={select}
                    onReveal={reveal}
                    onShowInMemory={showInMemory}
                  />
                ))}
              </tbody>
            </table>
          </ScrollViewer>
        </div>
      )}
    </FullPanel>
  );
};

type RowProps = {
  x: DmaTransfer;
  selected: boolean;
  onSelect: (x: DmaTransfer) => void;
  onReveal: (pc: number) => void;
  onShowInMemory: (x: DmaTransfer) => Promise<void>;
};

const TransferRow = ({ x, selected, onSelect, onReveal, onShowInMemory }: RowProps) => {
  const t = useT();
  const src = transferSource(x);
  const dst = transferDestination(x);
  const block = blockBytes(x);
  const rect = (x.ddma.flags & DDMA_2D) !== 0 ? `${Math.max(1, x.ddma.rowLength)} × ${Math.max(1, x.ddma.rowCount)}` : undefined;
  const tinted = (src.kind === "memory" && !src.physical) || (dst.kind === "memory" && !dst.physical);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <tr
      className={classnames(styles.row, { [styles.selected]: selected })}
      aria-selected={selected}
      onClick={() => onSelect(x)}
    >
      <td>{x.seq + 1}</td>
      <td>{fmt(x.frame)}</td>
      <td onClick={stop}>
        {x.joined ? (
          <span className={styles.secondary} title={t("panels.doc.dmaXfer.joinedTitle")}>
            {t("panels.doc.dmaXfer.joined")}
          </span>
        ) : x.pc === undefined ? (
          <span className={styles.secondary}>{t("panels.doc.dmaXfer.host")}</span>
        ) : (
          <button type="button" className={styles.pc} title={t("panels.doc.dmaXfer.pcTitle")} onClick={() => onReveal(x.pc!)}>
            {hex4(x.pc)}
          </button>
        )}
      </td>
      <td className={styles.text}>{modeText(x)}</td>
      <td>{sideText(src)}</td>
      <td>
        {sideText(dst)}
        {rect && <span className={styles.secondary}> {rect}</span>}
      </td>
      <td className={styles.num}>
        {x.end === "running" && x.restarts === 0 ? `${fmt(x.bytes)} / ${fmt(block)}` : fmt(x.bytes)}
      </td>
      <td className={styles.num}>{t("panels.doc.dmaXfer.tStates", { t: fmt(xferClocksToT(x.held28, x.speed)) })}</td>
      <td className={styles.result}>
        <span className={classnames(styles.pill, x.end === "running" ? styles.pillRun : x.end === "endOfBlock" ? styles.pillOk : styles.pillStop)}>
          {t(END_KEYS[x.end])}
        </span>
        {x.restarts > 0 && (
          <span className={styles.pill}>{t("panels.doc.dmaXfer.restarts", { times: x.restarts >= 255 ? "255+" : String(x.restarts) })}</span>
        )}
        {x.intLost && (
          <span className={classnames(styles.pill, styles.pillBad)} title={t("panels.doc.dmaXfer.intLostTitle")}>
            {t("panels.doc.dmaXfer.intLost")}
          </span>
        )}
        {x.notLoaded && (
          <span className={classnames(styles.pill, styles.pillWarn)} title={t("panels.doc.dmaXfer.notLoadedTitle")}>
            {t("panels.doc.dmaXfer.notLoaded")}
          </span>
        )}
        {selected && tinted && (
          <button
            type="button"
            className={styles.link}
            onClick={(e) => {
              stop(e);
              void onShowInMemory(x);
            }}
          >
            {t("panels.doc.dmaXfer.showInMemory")}
          </button>
        )}
      </td>
    </tr>
  );
};

export const createDmaTransfersPanel = ({ document, viewState }: DocumentProps) => (
  <DmaTransfersPanel document={document} viewState={viewState} />
);
