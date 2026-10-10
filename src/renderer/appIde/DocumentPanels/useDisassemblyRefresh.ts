import { MI_ZXNEXT } from "@common/machines/constants";
import type { EmuApi, MemoryInfo } from "@common/messaging/EmuApi";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { MemorySectionType, type IMemorySection } from "@abstractions/MemorySection";
import type { MutableRefObject } from "react";
import { useCallback, useRef, useState } from "react";
import {
  DisassemblyItem,
  MemorySection,
  type DisassemblyOptions
} from "../disassemblers/common-types";
import type { ICustomDisassembler } from "../disassemblers/z80-disassembler/custom-disassembly";
import type { CustomDisassemblyContext } from "../disassemblers/z80-disassembler/rom-gated-disassembler";
import type { DisassemblyOperandLabelResolver } from "../disassemblers/common-types";
import type { CachedRefreshState } from "./disassemblyViewState";
import type { BranchCpuSnapshot } from "./branchVerdict";
import { buildBreakpointMap, type BreakpointsByAddress } from "./breakpointRowMatch";

type DisassemblyOutput = {
  outputItems: DisassemblyItem[];
};

type DisassemblerInstance = {
  disassemble: (startAddress?: number, endAddress?: number) => Promise<DisassemblyOutput | null>;
  setAddressOffset: (addressOffset: number) => void;
  setCustomDisassembler?: (customDisassembler: ICustomDisassembler) => void;
};

export type DisassemblerFactory = (
  memorySections: MemorySection[],
  memoryContents: Uint8Array,
  partitionLabels?: string[],
  options?: DisassemblyOptions
) => DisassemblerInstance;

type DisassemblyRefreshParams = {
  cachedRefreshState: MutableRefObject<CachedRefreshState>;
  customDisassembly?: (() => ICustomDisassembler) | unknown;

  /**
   * Optionally builds an operand-name resolver — the live view's route to a NEX's labels.
   *
   * A **factory over the current paging**, not a resolver, and that shape is forced: naming a
   * local label needs to know which bank is at an address, the paging arrives with the memory read
   * this hook performs, and the caller cannot have it before the hook runs. Taking a finished
   * resolver made the panel depend on a value this hook produces — a cycle — and the only way to
   * break it from the outside would be to name from the *previous* refresh's paging, which is
   * wrong for exactly the case the feature is for.
   *
   * The caller supplies the symbols (a document-level concern this hook knows nothing about); the
   * hook supplies the paging, fresh. Absent leaves the disassembler's own rendering as it was.
   *
   * @param mem64kLabels the partition label of each 8K slot, as the emulator just reported it
   */
  operandLabelSource?: (
    mem64kLabels: string[],
    slots?: (number | undefined)[]
  ) => DisassemblyOperandLabelResolver | undefined;
  /**
   * Turns the plain listing into the annotated one (`annotateLiveListing`): annotated banks and ROM
   * pages re-listed from their regions, every row labelled through the shared resolver. Absent
   * leaves the listing as the disassembler made it.
   */
  annotateItems?: (context: LiveListingContext) => Promise<DisassemblyItem[]>;
  /**
   * What the machine's custom disassembler is gated with, for this read's paging: it decodes the
   * data after `RST $08`/`RST $28` only inside the ROM it describes (`rom-gated-disassembler.ts`).
   */
  customDisassemblyContext?: (
    slots: (number | undefined)[] | undefined,
    partition: number | undefined
  ) => CustomDisassemblyContext;
  disassOffset: number;
  disassemblerFactory?: DisassemblerFactory;
  emuApi: Pick<EmuApi, "getDisassemblySections" | "getMemoryContents">;
  machineId: string | undefined;
  onFollowPcTopAddress?: (address: number) => void;
};

/** What the annotated listing needs from one refresh. */
export type LiveListingContext = {
  items: DisassemblyItem[];
  memory: Uint8Array;
  /** The address `memory[0]` is listed at. */
  memoryBase: number;
  /** The partition shown in a bank view; `undefined` for the 64K view. */
  partition?: number;
  /** The code sections as `[start, end]`, in listed addresses. */
  ranges: [number, number][];
  /** The partition at each 8K slot, as this read reported it. */
  slots?: (number | undefined)[];
  pc: number;
  decimalView: boolean;
  /** Sets the machine's custom disassembler on a disassembler instance. */
  prepareDisassembler: (disassembler: unknown) => void;
};

/**
 * The part of a `getMemoryContents` response a branch verdict can be judged against.
 *
 * Narrow on purpose: the response also carries `de`, the shadow bank, `ir` and `wz`, none of which
 * any branch depends on, and naming only what is used keeps the dependency honest.
 */
export type BranchSnapshotSource = Pick<
  MemoryInfo,
  "memory" | "pc" | "af" | "bc" | "hl" | "ix" | "iy" | "sp"
>;

/**
 * Builds the register snapshot a branch verdict is judged against, from the response the panel
 * already fetches on every refresh.
 *
 * There is no extra IPC here and no extra polling: `getMemoryContents` has always returned the
 * register file alongside the memory image, and this hook simply stopped throwing it away.
 *
 * @param source The memory-and-registers response
 * @param isFlatMemory Whether `memory` is the flat 64K image rather than a single partition.
 * Governs whether a `readByte` is offered at all — see below.
 */
export function createBranchCpuSnapshot(
  source: BranchSnapshotSource,
  isFlatMemory: boolean
): BranchCpuSnapshot {
  return {
    af: source.af,
    bc: source.bc,
    hl: source.hl,
    ix: source.ix,
    iy: source.iy,
    sp: source.sp,
    pc: source.pc,
    /*
     * Only the flat 64K view can resolve an absolute address.
     *
     * With a partition selected, `memory` is that bank's contents indexed from zero, so
     * `memory[sp]` would be a byte of the bank that happens to sit at the same offset — a plausible
     * number bearing no relation to the stack. `RET cc` then reports `unobtainable`, which is the
     * honest answer, rather than a confident wrong address.
     */
    readByte: isFlatMemory
      ? (address: number) => (address < source.memory.length ? source.memory[address] : undefined)
      : undefined
  };
}

/** The memory and paging the listing was last made from: what a live annotation edit previews. */
export type LiveMemorySnapshot = {
  memory: Uint8Array;
  memoryBase: number;
  slots?: (number | undefined)[];
};

export type DisassemblyRefreshResult = {
  breakpoints: BreakpointInfo[];
  /** The last read's memory and paging; undefined before the first refresh. */
  memorySnapshot?: LiveMemorySnapshot;
  breakpointMap: BreakpointsByAddress;
  items: DisassemblyItem[];
  mem64kLabels: string[];
  pausedPc: number;
  /**
   * While the history cursor is in the past (`.plans/LITE_STEP_BACK_PLAN.md` T2): its step, and the
   * bytes the CPU decoded at `pausedPc` then. Undefined at the present.
   */
  history?: { position: number; bytes: number[] };
  refreshDisassembly: () => Promise<void>;
  refreshVersion: number;
  /**
   * Registers as of the last refresh, for judging branch verdicts against.
   *
   * `undefined` until the first refresh completes. It is deliberately *not* gated on machine state
   * here — this hook has no view of that — so a consumer must decide for itself whether a live
   * verdict is meaningful. See `DisassemblyPanel`.
   */
  cpuSnapshot?: BranchCpuSnapshot;
};

export function resolveDisassemblyPartition(state: CachedRefreshState): number | undefined {
  if (state.isFullView) {
    return undefined;
  }

  const partition = state.currentSegment;
  return isNaN(partition) ? -1 : partition;
}

export function createFollowPcMemorySections(pcAddr: number): MemorySection[] {
  let endAddr = (pcAddr + 1024) & 0xffff;

  if (endAddr < pcAddr || endAddr > 0xfff9) {
    endAddr = 0xffff;
  }

  if (endAddr > 0xfff9) {
    return [
      new MemorySection(pcAddr, 0xfff9, MemorySectionType.Disassemble),
      new MemorySection(0xfffa, 0xfffb, MemorySectionType.WordArray),
      new MemorySection(0xfffc, 0xfffd, MemorySectionType.WordArray),
      new MemorySection(0xfffe, 0xffff, MemorySectionType.WordArray)
    ];
  }

  return [new MemorySection(pcAddr, endAddr, MemorySectionType.Disassemble)];
}

export function createManualMemorySections(sections: IMemorySection[]): MemorySection[] {
  return sections.map(
    (section) =>
      new MemorySection(section.startAddress, section.endAddress, section.sectionType)
  );
}

export function useDisassemblyRefresh({
  cachedRefreshState,
  customDisassembly,
  operandLabelSource,
  annotateItems,
  customDisassemblyContext,
  disassOffset,
  disassemblerFactory,
  emuApi,
  machineId,
  onFollowPcTopAddress
}: DisassemblyRefreshParams): DisassemblyRefreshResult {
  const [items, setItems] = useState<DisassemblyItem[]>([]);
  const [breakpoints, setBreakpoints] = useState<BreakpointInfo[]>([]);
  const [breakpointMap, setBreakpointMap] = useState<BreakpointsByAddress>(() => new Map());
  const [mem64kLabels, setMem64kLabels] = useState<string[]>([]);
  const [pausedPc, setPausedPc] = useState(0);
  // --- The history cursor's step and the bytes the CPU decoded at its PC (T2)
  const [history, setHistory] = useState<{ position: number; bytes: number[] }>();
  const [cpuSnapshot, setCpuSnapshot] = useState<BranchCpuSnapshot | undefined>(undefined);
  const [memorySnapshot, setMemorySnapshot] = useState<LiveMemorySnapshot | undefined>(undefined);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refreshInProgress = useRef(false);
  const refreshPending = useRef(false);
  const activeRefresh = useRef<Promise<void> | null>(null);

  const refreshDisassembly = useCallback(() => {
    if (!disassemblerFactory) {
      return Promise.resolve();
    }

    if (refreshInProgress.current) {
      refreshPending.current = true;
      return activeRefresh.current ?? Promise.resolve();
    }

    const refreshPromise = (async () => {
      refreshInProgress.current = true;
      try {
        do {
          refreshPending.current = false;
          const refreshState = cachedRefreshState.current;
          const partition = resolveDisassemblyPartition(refreshState);
          const getMemoryResponse = await emuApi.getMemoryContents(partition);
          const memory = getMemoryResponse.memory;

          // --- In the past, Follow-PC follows the history cursor (LITE_STEP_BACK_PLAN D2, T2)
          const history = getMemoryResponse.history;
          const pc = history?.pc ?? getMemoryResponse.pc;
          const memSections = refreshState.autoRefresh
            ? createFollowPcMemorySections(pc)
            : createManualMemorySections(
                await emuApi.getDisassemblySections({
                  ram: refreshState.ram,
                  screen: refreshState.screen
                })
              );

          const disassembler = disassemblerFactory(
            memSections,
            memory,
            getMemoryResponse.partitionLabels,
            {
              noLabelPrefix: false,
              allowExtendedSet: machineId === MI_ZXNEXT,
              decimalMode: refreshState.decimalView,
              // --- Built from the paging this very read reported, so a name is never one tick out.
              operandLabelResolver: operandLabelSource?.(
                getMemoryResponse.partitionLabels,
                getMemoryResponse.slotPartitions
              ),
              getRomPage: () => {
                return refreshState.isFullView
                  ? getMemoryResponse.selectedRom
                  : refreshState.currentSegment < 0
                    ? -refreshState.currentSegment - 1
                    : -1;
              }
            }
          );

          if (partition !== undefined && !refreshState.autoRefresh) {
            let page = disassOffset ?? 0;
            if (isNaN(page)) {
              page = 0;
            }
            disassembler.setAddressOffset(page);
          }

          const customContext = customDisassemblyContext?.(getMemoryResponse.slotPartitions, partition);
          const createCustom = () =>
            (customDisassembly as (context?: CustomDisassemblyContext) => ICustomDisassembler)(
              customContext
            );
          if (customDisassembly && typeof customDisassembly === "function") {
            disassembler.setCustomDisassembler?.(createCustom());
          }

          const output = await disassembler.disassemble(
            0x0000,
            refreshState.isFullView || refreshState.autoRefresh ? 0xffff : 0x3fff
          );
          let outputItems = output?.outputItems ?? [];
          if (annotateItems) {
            const base =
              partition !== undefined && !refreshState.autoRefresh ? (disassOffset || 0) : 0;
            outputItems = await annotateItems({
              items: outputItems,
              memory,
              memoryBase: base,
              partition,
              ranges: memSections
                .filter((section) => section.sectionType === MemorySectionType.Disassemble)
                .map((section) => [section.startAddress + base, section.endAddress + base]),
              slots: getMemoryResponse.slotPartitions,
              pc,
              decimalView: refreshState.decimalView,
              prepareDisassembler: (instance) => {
                if (customDisassembly && typeof customDisassembly === "function") {
                  (instance as DisassemblerInstance).setCustomDisassembler?.(createCustom());
                }
              }
            });
          }
          const memoryBreakpoints = getMemoryResponse.memBreakpoints ?? [];

          setItems(outputItems);
          setMemorySnapshot({
            memory,
            memoryBase: partition !== undefined && !refreshState.autoRefresh ? disassOffset || 0 : 0,
            slots: getMemoryResponse.slotPartitions
          });
          setMem64kLabels(getMemoryResponse.partitionLabels);
          setPausedPc(pc);
          setHistory(history ? { position: history.position, bytes: history.bytes } : undefined);
          // --- `partition === undefined` is the 64K view, which is the only one whose memory image
          // --- can be indexed by an absolute address. See `createBranchCpuSnapshot`. In the past the
          // --- registers are the record's and memory is the present's: no stack reads (RET cc is
          // --- then "unobtainable", the honest answer)
          setCpuSnapshot(
            history
              ? createBranchCpuSnapshot({ ...history.regs, memory: getMemoryResponse.memory }, false)
              : createBranchCpuSnapshot(getMemoryResponse, partition === undefined)
          );
          setBreakpoints(memoryBreakpoints);
          setBreakpointMap(buildBreakpointMap(memoryBreakpoints));
          setRefreshVersion((version) => version + 1);

          if (refreshState.autoRefresh && outputItems.length > 0) {
            onFollowPcTopAddress?.(outputItems[0].address);
          }
        } while (refreshPending.current);
      } finally {
        refreshInProgress.current = false;
        activeRefresh.current = null;
      }
    })();

    activeRefresh.current = refreshPromise;
    return refreshPromise;
  }, [
    cachedRefreshState,
    customDisassembly,
    operandLabelSource,
    annotateItems,
    customDisassemblyContext,
    disassOffset,
    disassemblerFactory,
    emuApi,
    machineId,
    onFollowPcTopAddress
  ]);

  return {
    breakpoints,
    memorySnapshot,
    breakpointMap,
    cpuSnapshot,
    history,
    items,
    mem64kLabels,
    pausedPc,
    refreshDisassembly,
    refreshVersion
  };
}
