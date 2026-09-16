import { useCallback, useEffect, useRef, useState } from "react";

import { MI_ZXNEXT } from "@common/machines/constants";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEmuApi } from "@renderer/core/EmuApi";
import type { Z80CpuState } from "@common/messaging/EmuApi";
import type { BranchCpuSnapshot } from "@renderer/appIde/DocumentPanels/branchVerdict";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";

import {
  bankOffsetOfAddress,
  locateBank16k,
  type BankPlacement
} from "./nextBankLocation";
import { bankPartitions, joinBankHalves, machineHasRun, sameBankBytes } from "./nexLiveBank";
import { getNexLoad } from "./nexLoadSession";
import { loadNexAnnotationSidecar } from "./nexAnnotationSidecar";
import type { NexFileAnnotations } from "./nexAnnotations";

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
 * say — no bank, a machine that is not a ZX Spectrum Next, or one that has not been started.
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
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const [placements, setPlacements] = useState<BankPlacement[] | undefined>(undefined);

  /*
   * The whole-class gate: everything downstream of this readout is a claim about a running machine.
   * Live bank bytes, the branch gutter's verdicts and the location line itself all key off it, so
   * withholding it while the machine is off is what keeps a popped-out bank showing the file.
   */
  const enabled = bank !== undefined && machineId === MI_ZXNEXT && machineHasRun(machineState);

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
 * is looking at it or not. It used to carry the user's own "Live" switch; there is no switch any
 * more — a popped-out bank shows the machine whenever the machine can answer — so what it now
 * carries is that same question asked of `useNexBankLocation`: reads run when a ZX Spectrum Next is
 * there with this bank in it, and stop when there is no machine to read.
 *
 * The result keeps its array identity when the bytes have not moved (`sameBankBytes`). That matters
 * more now than it did behind a switch: the disassembly is rebuilt from these bytes, and a fresh
 * array every tick would re-disassemble an idle bank several times a second.
 *
 * @param bank The 16K bank to read
 * @param wanted Whether the machine is in a position to answer for this bank
 */
export function useNexLiveBankBytes(
  bank: number | undefined,
  wanted: boolean
): Uint8Array | undefined {
  const emuApi = useEmuApi();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const [bytes, setBytes] = useState<Uint8Array | undefined>(undefined);

  /*
   * `machineHasRun` again, even though the caller's `wanted` already comes from a gate that checks
   * it. This hook's contract is "the bytes as they are in the machine *now*", and a machine that has
   * never run has no now — zeros read back as a bankful of `nop` and look like a decoded program.
   * A caller that gets the gate wrong should get no bytes, not plausible ones.
   */
  const enabled =
    wanted && bank !== undefined && machineId === MI_ZXNEXT && machineHasRun(machineState);

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
      const joined = joinBankHalves(low?.memory, high?.memory);
      // --- Keep the old array when the bytes are unchanged, so consumers keyed on identity (the
      // --- disassembly effect, above all) see a change only when the machine actually wrote.
      setBytes((prev) => (sameBankBytes(prev, joined) ? prev : joined));
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
  const machineState = useSelector((s) => s.emulatorState?.machineState);
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

  /*
   * Recompute as soon as the placements arrive, rather than waiting for the ticker.
   *
   * The listener above fires once on registration and then only when the machine's state, PC or
   * tact count *changes* — and on a machine that is paused and idle, none of them do. Its fallback
   * for "nothing changed" is five seconds. So on a freshly opened bank document the first run found
   * `placements` still `undefined` (they are fetched asynchronously by `useNexBankLocation`), gave
   * up, and the execution-point marker then took up to five seconds to appear while everything else
   * on screen was already correct.
   *
   * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.18.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (machineState !== MachineControllerState.Paused || !placements?.length) {
        setOffset(undefined);
        return;
      }
      try {
        const cpu = await emuApi.getCpuStateChunk();
        if (!cancelled) setOffset(bankOffsetOfAddress(placements, cpu?.pcValue));
      } catch {
        if (!cancelled) setOffset(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [emuApi, machineState, placements]);

  return offset;
}

/**
 * The register snapshot the branch gutter evaluates against, for a popped-out NEX bank.
 *
 * No `readByte`: this document holds one 16K bank, not the flat 64K map, so an absolute `SP` cannot
 * be resolved in it. `createBranchCpuSnapshot` withholds the reader for exactly this reason in the
 * Disassembly panel's partition mode, and a `RET cc` then reports `unobtainable` — the honest answer
 * rather than a byte of whichever bank happens to sit at the same offset.
 *
 * Refreshed on the shared ticker *and* in an effect, for the reason §15.18b records: the ticker only
 * fires when the machine's state, PC or tacts change, and its fallback on an idle paused machine is
 * five seconds — long enough for a freshly opened document to look broken.
 *
 * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.19.
 */
export function useNexBranchCpuSnapshot(enabled: boolean): BranchCpuSnapshot | undefined {
  const emuApi = useEmuApi();
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const [snapshot, setSnapshot] = useState<BranchCpuSnapshot | undefined>(undefined);

  const read = useCallback(async () => {
    if (!enabled) {
      setSnapshot(undefined);
      return;
    }
    try {
      const cpu = (await emuApi.getCpuState()) as Z80CpuState;
      setSnapshot({
        af: cpu.af,
        bc: cpu.bc,
        hl: cpu.hl,
        ix: cpu.ix,
        iy: cpu.iy,
        sp: cpu.sp,
        pc: cpu.pc
      });
    } catch {
      // --- No machine, or one mid-switch: no verdicts rather than verdicts from stale registers.
      setSnapshot(undefined);
    }
  }, [emuApi, enabled]);

  useEmuStateListener(emuApi, read);

  useEffect(() => {
    void read();
  }, [read, machineState]);

  return enabled ? snapshot : undefined;
}

/**
 * The annotations of the NEX launched in this session, for the live Disassembly view.
 *
 * Loaded from the sidecar of whatever `nex-run` last launched (§11.5's load session), so the live
 * view can name addresses with the labels the user wrote in the NEX viewer — `call DrawSprite`
 * rather than `call $C100`, at the moment the name is worth most.
 *
 * `getNexLoad()` is a module singleton and not reactive, which is sound here for the same reason it
 * is in the Memory Mapping panel: its identity only changes when a NEX is launched, and this panel
 * re-renders on the disassembly refresh tick, so a launch is picked up within a tick. It is read
 * during render rather than subscribed to because there is nothing to subscribe to — and adding a
 * subscription for a value that changes once per launch would be machinery for its own sake.
 *
 * `undefined` until the sidecar is read, and if it has none: then the live view renders exactly as
 * it did before, which is what an absent resolver guarantees.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §13.1.
 */
export function useLaunchedNexAnnotations(): NexFileAnnotations | undefined {
  const { projectService } = useAppServices();
  const [annotations, setAnnotations] = useState<NexFileAnnotations | undefined>(undefined);
  const loaded = getNexLoad();

  const projectServiceRef = useRef(projectService);
  projectServiceRef.current = projectService;

  useEffect(() => {
    if (!loaded) {
      setAnnotations(undefined);
      return undefined;
    }
    let cancelled = false;
    // --- The sidecar sits beside the NEX, as `.nex.dis`. The banks it declares are passed so the
    // --- parser can report annotations for banks the file does not contain.
    loadNexAnnotationSidecar(
      projectServiceRef.current,
      { fullPath: `${loaded.path}.dis` },
      loaded.banks
    ).then((state) => {
      if (cancelled) return;
      setAnnotations(state.status === "loaded" ? state.annotations : undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  return annotations;
}
