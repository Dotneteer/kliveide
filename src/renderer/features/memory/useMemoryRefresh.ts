import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { PartitionRole } from "@common/annotations/partitionInfo";
import type { EmuApi, MemoryInfo } from "@common/messaging/EmuApi";
import type { MutableRefObject } from "react";
import { useCallback, useRef, useState } from "react";
import {
  CachedRefreshState,
  buildPointedRegisterHints,
  resolveMemoryPartition
} from "./memoryViewModel";
import { measureMemoryRefresh } from "./memoryPerformance";

type MemoryRefreshParams = {
  allowRefresh: MutableRefObject<boolean>;
  cachedRefreshState: MutableRefObject<CachedRefreshState>;
  emuApi: Pick<EmuApi, "getMemoryContents">;
  machineState: MachineControllerState | undefined;
};

export type MemoryRefreshResult = {
  memory: Uint8Array;
  memoryLength: number;
  memoryVersion: number;
  mem64kLabels: string[];
  pointedRegs: Record<number, string>;
  /** The register values of the last refresh (`registerValuesOf`), for the strip, Go to and Follow */
  registers?: MemoryRegisters;
  /** The partition in each 8K slot now */
  slotPartitions?: (number | undefined)[];
  /** Which partitions hold the screens now (plan D8) */
  partitionRoles?: Record<number, PartitionRole[]>;
  memBreakpoints: BreakpointInfo[];
  /**
   * The bytes as they were at the previous stop, for the "changed since the previous stop" dots
   * (§5.1): while paused, the stop before this one; while running, the last stop. Undefined when
   * there is none, or when the view or the paging changed since.
   */
  baseline?: Uint8Array;
  refreshMemoryView: () => Promise<void>;
};

/** The registers a refresh reads, by the fields of `MemoryInfo` */
export type MemoryRegisters = Pick<
  MemoryInfo,
  "pc" | "sp" | "af" | "bc" | "de" | "hl" | "af_" | "bc_" | "de_" | "hl_" | "ix" | "iy" | "ir" | "wz"
>;

/** What a stop's bytes were taken from: the same view and paging, or the baseline means nothing */
type StopSnapshot = { tacts: number; key: string; bytes: Uint8Array };

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

export function useMemoryRefresh({
  allowRefresh,
  cachedRefreshState,
  emuApi,
  machineState
}: MemoryRefreshParams): MemoryRefreshResult {
  const [memory, setMemory] = useState<Uint8Array>(() => new Uint8Array(0x1_0000));
  const [memoryVersion, setMemoryVersion] = useState(0);
  const [mem64kLabels, setMem64kLabels] = useState<string[]>([]);
  const [pointedRegs, setPointedRegs] = useState<Record<number, string>>({});
  const [details, setDetails] = useState<{
    registers?: MemoryRegisters;
    slotPartitions?: (number | undefined)[];
    partitionRoles?: Record<number, PartitionRole[]>;
    memBreakpoints: BreakpointInfo[];
    baseline?: Uint8Array;
  }>({ memBreakpoints: [] });
  const lastStop = useRef<StopSnapshot>();
  const stopBefore = useRef<StopSnapshot>();
  const refreshInProgress = useRef(false);
  const refreshPending = useRef(false);
  const activeRefresh = useRef<Promise<void> | null>(null);

  const refreshMemoryView = useCallback(() => {
    if (!allowRefresh.current) {
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
          if (!allowRefresh.current) {
            break;
          }

          const partition = resolveMemoryPartition(cachedRefreshState.current);
          const response = await measureMemoryRefresh(
            partition,
            () => emuApi.getMemoryContents(partition)
          );

          setMemory(new Uint8Array(response.memory));
          setMemoryVersion((version) => version + 1);
          setMem64kLabels((prevLabels) =>
            arraysEqual(prevLabels, response.partitionLabels)
              ? prevLabels
              : response.partitionLabels
          );
          setPointedRegs(buildPointedRegisterHints(response, machineState));

          // --- The baseline: a stop is told from the next by the tact counter; a snapshot of
          // --- another view or another paging is no baseline for this one
          const bytes = new Uint8Array(response.memory);
          const key = `${partition ?? "64k"}|${(response.slotPartitions ?? []).join(",")}`;
          let baseline: Uint8Array | undefined;
          const paused =
            machineState === MachineControllerState.Paused || machineState === MachineControllerState.Stopped;
          if (paused && response.tacts !== undefined) {
            if (lastStop.current?.tacts !== response.tacts || lastStop.current?.key !== key) {
              stopBefore.current = lastStop.current;
              lastStop.current = { tacts: response.tacts, key, bytes };
            }
            baseline = stopBefore.current?.key === key ? stopBefore.current.bytes : undefined;
          } else {
            baseline = lastStop.current?.key === key ? lastStop.current.bytes : undefined;
          }
          setDetails({
            registers: {
              pc: response.pc,
              sp: response.sp,
              af: response.af,
              bc: response.bc,
              de: response.de,
              hl: response.hl,
              af_: response.af_,
              bc_: response.bc_,
              de_: response.de_,
              hl_: response.hl_,
              ix: response.ix,
              iy: response.iy,
              ir: response.ir,
              wz: response.wz
            },
            slotPartitions: response.slotPartitions,
            partitionRoles: response.partitionRoles,
            memBreakpoints: response.memBreakpoints ?? [],
            baseline
          });
        } while (refreshPending.current);
      } finally {
        refreshInProgress.current = false;
        activeRefresh.current = null;
      }
    })();

    activeRefresh.current = refreshPromise;
    return refreshPromise;
  }, [allowRefresh, cachedRefreshState, emuApi, machineState]);

  return {
    memory,
    memoryLength: memory.length,
    memoryVersion,
    mem64kLabels,
    pointedRegs,
    ...details,
    refreshMemoryView
  };
}
