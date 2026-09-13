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
  disassOffset: number;
  disassemblerFactory?: DisassemblerFactory;
  emuApi: Pick<EmuApi, "getDisassemblySections" | "getMemoryContents">;
  machineId: string | undefined;
  onFollowPcTopAddress?: (address: number) => void;
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

export type DisassemblyRefreshResult = {
  breakpoints: BreakpointInfo[];
  breakpointMap: BreakpointsByAddress;
  items: DisassemblyItem[];
  mem64kLabels: string[];
  pausedPc: number;
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
  const [cpuSnapshot, setCpuSnapshot] = useState<BranchCpuSnapshot | undefined>(undefined);
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

          const memSections = refreshState.autoRefresh
            ? createFollowPcMemorySections(getMemoryResponse.pc)
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

          if (customDisassembly && typeof customDisassembly === "function") {
            disassembler.setCustomDisassembler?.(customDisassembly() as ICustomDisassembler);
          }

          const output = await disassembler.disassemble(
            0x0000,
            refreshState.isFullView || refreshState.autoRefresh ? 0xffff : 0x3fff
          );
          const outputItems = output?.outputItems ?? [];
          const memoryBreakpoints = getMemoryResponse.memBreakpoints ?? [];

          setItems(outputItems);
          setMem64kLabels(getMemoryResponse.partitionLabels);
          setPausedPc(getMemoryResponse.pc);
          // --- `partition === undefined` is the 64K view, which is the only one whose memory image
          // --- can be indexed by an absolute address. See `createBranchCpuSnapshot`.
          setCpuSnapshot(createBranchCpuSnapshot(getMemoryResponse, partition === undefined));
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
    disassOffset,
    disassemblerFactory,
    emuApi,
    machineId,
    onFollowPcTopAddress
  ]);

  return {
    breakpoints,
    breakpointMap,
    cpuSnapshot,
    items,
    mem64kLabels,
    pausedPc,
    refreshDisassembly,
    refreshVersion
  };
}
