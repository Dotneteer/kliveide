import { useEffect, useState, useSyncExternalStore } from "react";

import { DMA_TRANSFERS_PANEL_ID } from "@common/state/common-ids";
import { decodeDmaTransfers, memoryOverlayOf, type DmaMemoryOverlay } from "@common/zxnext/dma/dmaTransfers";
import type { EmuApi } from "@common/messaging/EmuApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";

/*
 * The transfer the DMA Transfers document selected for the Memory panel's overlay
 * (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §14.2). It lives outside both components: a document is
 * mounted only while it is the active tab, so the selection must outlast the Transfers document while
 * the Memory panel is the one shown.
 */

let selected: number | undefined;
const listeners = new Set<() => void>();

export function getDmaOverlaySelection(): number | undefined {
  return selected;
}

/** Selects a transfer by its sequence number for the overlay, or clears it with undefined */
export function setDmaOverlaySelection(seq: number | undefined): void {
  if (seq === selected) return;
  selected = seq;
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useDmaOverlaySelection(): number | undefined {
  return useSyncExternalStore(subscribe, getDmaOverlaySelection);
}

/**
 * The selected transfer's overlay, read from the machine whenever `refreshKey` changes (the Memory
 * panel passes its own refresh counter, so it keeps one state listener): its ranges so far and,
 * while it runs, the DMA's working addresses. Undefined without a selection, on a machine without the
 * ring, or once the Transfers document is closed (which also drops the selection and the recording).
 */
/** The DMA's working addresses and the bytes the block under way has moved (Zilog mode counts from -1) */
export async function dmaWorking(emuApi: EmuApi) {
  const state = await emuApi.getDmaState();
  const [src, dst] = state.aToB ? [state.portA, state.portB] : [state.portB, state.portA];
  const blockMoved = state.dialect === "z80" ? (state.counter + 1) & 0xffff : state.counter;
  return { source: src.working, destination: dst.working, blockMoved };
}

export function useDmaMemoryOverlay(emuApi: EmuApi, refreshKey: unknown): DmaMemoryOverlay | undefined {
  const seq = useDmaOverlaySelection();
  const { projectService } = useAppServices();
  const [overlay, setOverlay] = useState<DmaMemoryOverlay>();

  const refresh = async () => {
    if (seq === undefined) {
      setOverlay(undefined);
      return;
    }
    if (!projectService.getActiveDocumentHubService().isOpen(DMA_TRANSFERS_PANEL_ID)) {
      setDmaOverlaySelection(undefined);
      await emuApi.setDmaTransfersRecording(false).catch(() => undefined);
      setOverlay(undefined);
      return;
    }
    try {
      const ring = await emuApi.getDmaTransfers(seq);
      const t = decodeDmaTransfers(ring).find((x) => x.seq === seq);
      if (!t) {
        setOverlay(undefined);
        return;
      }
      setOverlay(memoryOverlayOf(t, t.end === "running" ? await dmaWorking(emuApi) : undefined));
    } catch {
      setOverlay(undefined);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, refreshKey]);
  return overlay;
}
