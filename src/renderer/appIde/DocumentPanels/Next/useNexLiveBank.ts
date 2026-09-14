import { useRef, useState } from "react";

import { MI_ZXNEXT } from "@common/machines/constants";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";

import {
  bankOffsetOfAddress,
  locateBank16k,
  type BankPlacement
} from "./nextBankLocation";
import { bankPartitions, joinBankHalves } from "./nexLiveBank";

/*
 * What the machine says about the bank a popped-out NEX document is showing: where it is, and what
 * is in it now.
 *
 * Both answers come from the emulator rather than from the file, and both refresh on the same
 * ticker, so they are neighbours here. The breakpoint hooks live in `useNexBankBreakpoints.ts`;
 * `useNexBankLocation` started there and was moved once it was clear it had nothing to do with
 * breakpoints.
 */

/**
 * Where the bank this document shows is paged in right now, or `undefined` when there is nothing to
 * say — no bank, or a machine that is not a ZX Spectrum Next.
 *
 * Refreshed through `useEmuStateListener`, the same ticker the Memory Mapping panel and the register
 * panels use: it reports immediately when the machine pauses and throttles while it runs, which is
 * exactly the cadence this wants — the answer only matters when the user is looking at a paused
 * machine, and polling the MMU every frame while it runs would be waste.
 *
 * See `nextBankLocation.ts` for what the answer means, and `.plans/NEX_DEBUGGING_PLAN.md` §11.2.
 */
export function useNexBankLocation(bank: number | undefined): BankPlacement[] | undefined {
  const emuApi = useEmuApi();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const [placements, setPlacements] = useState<BankPlacement[] | undefined>(undefined);

  const enabled = bank !== undefined && machineId === MI_ZXNEXT;

  useEmuStateListener(emuApi, async () => {
    if (!enabled) {
      setPlacements(undefined);
      return;
    }
    try {
      const mapping = await emuApi.getNextMemoryMapping();
      setPlacements(locateBank16k(mapping?.pageInfo, bank));
    } catch {
      // --- No machine, or one mid-switch. Saying nothing is better than saying "not paged in",
      // --- which is a claim about a machine that is not there to make it about.
      setPlacements(undefined);
    }
  });

  return enabled ? placements : undefined;
}

/**
 * The bank's bytes as they are in the machine now, or `undefined` when they cannot be read.
 *
 * **A bank does not have to be paged in for this to work.** The emulator reads a partition straight
 * out of the Next's RAM, and a NEX's banks are all in RAM from the moment the loader put them
 * there — so the live view answers for every bank of the file, not only the two or three currently
 * visible to the Z80. That is more than §11.3 assumed, and it is the more useful behaviour: a bank
 * the program has finished with and paged out is exactly the one whose leftovers you want to see.
 *
 * Two 8K reads, because a Next partition is 8K and a bank is 16K. While the machine is *running*
 * the halves therefore come from two slightly different moments, so a 16K structure straddling the
 * join could look briefly inconsistent. Not worth guarding: the view is refreshed on a ticker, the
 * case it exists for is a paused machine, and a single atomic 16K read does not exist to ask for.
 *
 * `wanted` is what stops this being 16K of IPC per tick for every open bank document whether anyone
 * is looking at it or not. The caller passes its own switch, so the reads start when the user asks
 * for live bytes and stop when they go back to the file. Whether the switch can be *offered* is a
 * separate question, answered by `useNexBankLocation` — which the header needs anyway.
 *
 * @param bank The 16K bank to read
 * @param wanted Whether the caller is actually showing live bytes
 */
export function useNexLiveBankBytes(
  bank: number | undefined,
  wanted: boolean
): Uint8Array | undefined {
  const emuApi = useEmuApi();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const [bytes, setBytes] = useState<Uint8Array | undefined>(undefined);

  const enabled = wanted && bank !== undefined && machineId === MI_ZXNEXT;

  useEmuStateListener(emuApi, async () => {
    if (!enabled) {
      setBytes(undefined);
      return;
    }
    const [lowPartition, highPartition] = bankPartitions(bank);
    try {
      const [low, high] = await Promise.all([
        emuApi.getMemoryContents(lowPartition),
        emuApi.getMemoryContents(highPartition)
      ]);
      // --- `joinBankHalves` returns undefined for a half of the wrong size, which is what a
      // --- machine mid-switch can hand back. Showing nothing beats showing a torn bank.
      setBytes(joinBankHalves(low?.memory, high?.memory));
    } catch {
      setBytes(undefined);
    }
  });

  return enabled ? bytes : undefined;
}

/**
 * The offset within this bank that the program counter is at, or `undefined` when it is elsewhere.
 *
 * **Only while the machine is paused**, and that is the whole design rather than a limitation. The
 * popped-out document is a listing of one bank, which does not change as the machine runs; the
 * ticker samples at most once or twice a second while running, so a spotlight fed from it would
 * land on an essentially arbitrary instruction and *look* authoritative. A mark that is wrong but
 * confident is worse than no mark. Paused is also the only state in which "where is the program"
 * is a question with one answer.
 *
 * `placements` comes from `useNexBankLocation`, so this asks nothing of the emulator that the header
 * is not already asking: one cheap CPU-state read per tick, and only while paused.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §11.4.
 */
export function useNexBankPcOffset(
  placements: BankPlacement[] | undefined
): number | undefined {
  const emuApi = useEmuApi();
  const [offset, setOffset] = useState<number | undefined>(undefined);

  // --- Read through a ref: the callback below is re-created every render, and depending on the
  // --- placements' array identity would restart the listener on every one of them.
  const placementsRef = useRef(placements);
  placementsRef.current = placements;

  useEmuStateListener(emuApi, async (state) => {
    if (state !== MachineControllerState.Paused || !placementsRef.current?.length) {
      setOffset(undefined);
      return;
    }
    try {
      const cpu = await emuApi.getCpuStateChunk();
      setOffset(bankOffsetOfAddress(placementsRef.current, cpu?.pcValue));
    } catch {
      setOffset(undefined);
    }
  });

  return offset;
}
