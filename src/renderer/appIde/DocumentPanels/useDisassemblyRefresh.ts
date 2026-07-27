import { MI_ZXNEXT } from "@common/machines/constants";
import type { EmuApi } from "@common/messaging/EmuApi";
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

export type DisassemblyRefreshResult = {
  breakpoints: BreakpointInfo[];
  breakpointMap: Map<number, BreakpointInfo>;
  items: DisassemblyItem[];
  mem64kLabels: string[];
  pausedPc: number;
  refreshDisassembly: () => Promise<void>;
  refreshVersion: number;
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

function buildBreakpointMap(breakpoints: BreakpointInfo[]): Map<number, BreakpointInfo> {
  const map = new Map<number, BreakpointInfo>();
  breakpoints.forEach((breakpoint) => {
    if (breakpoint.address !== undefined) {
      map.set(breakpoint.address, breakpoint);
    }
    if (breakpoint.resolvedAddress !== undefined) {
      map.set(breakpoint.resolvedAddress, breakpoint);
    }
  });
  return map;
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
  const [breakpointMap, setBreakpointMap] = useState<Map<number, BreakpointInfo>>(() => new Map());
  const [mem64kLabels, setMem64kLabels] = useState<string[]>([]);
  const [pausedPc, setPausedPc] = useState(0);
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
    items,
    mem64kLabels,
    pausedPc,
    refreshDisassembly,
    refreshVersion
  };
}
