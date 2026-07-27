import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { EmuApi } from "@common/messaging/EmuApi";
import type { MutableRefObject } from "react";
import { useCallback, useRef, useState } from "react";
import {
  CachedRefreshState,
  buildPointedRegisterHints,
  resolveMemoryPartition
} from "./memoryViewModel";

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
  refreshMemoryView: () => Promise<void>;
};

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
          const response = await emuApi.getMemoryContents(partition);

          setMemory(new Uint8Array(response.memory));
          setMemoryVersion((version) => version + 1);
          setMem64kLabels((prevLabels) =>
            arraysEqual(prevLabels, response.partitionLabels)
              ? prevLabels
              : response.partitionLabels
          );
          setPointedRegs(buildPointedRegisterHints(response, machineState));
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
    refreshMemoryView
  };
}
