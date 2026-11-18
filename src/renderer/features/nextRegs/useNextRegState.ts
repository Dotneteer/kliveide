import { useCallback, useEffect, useRef, useState } from "react";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { NextRegDescriptor, RegValueState } from "@emu/machines/zxNext/nextRegDescriptors";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { baselineOf, type NextRegBaseline } from "./nextRegDocumentModel";

/*
 * The NextReg read path shared by the Debug sidebar's Next Registers panel and the Next Registers
 * document.
 *
 * - The descriptor table is static *per machine*, not global, so the machine it was fetched for is
 *   cached with it: keyed on nothing, a Next → Spectrum → Next round trip kept the first machine's
 *   slice descriptors and showed them against the second's registers.
 * - The state is one `getNextRegState()` per refresh, at the state panels' cadence.
 * - `baseline` is what the "changed since the previous stop" markers compare with: while paused, the
 *   values at the stop before this one; while running, the last stop. The stops are kept at module
 *   level, not in the hook, because the document area unmounts a document that is not active —
 *   switching tabs would otherwise forget the previous stop and clear every marker.
 */

let cachedDescriptors: Record<number, NextRegDescriptor> | undefined;
let cachedDescriptorsMachineId: string | undefined;

/** The NextReg descriptors of the current machine, by register number. */
export function useNextRegDescriptors(): Record<number, NextRegDescriptor> | undefined {
  const emuApi = useEmuApi();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  /*
   * Held in state as well as in the module-level cache: the cache survives remounts so the fetch
   * happens once per machine, the state is what makes the view re-render when it arrives.
   */
  const [descriptors, setDescriptors] = useState(() =>
    cachedDescriptorsMachineId === machineId ? cachedDescriptors : undefined
  );

  useEffect(() => {
    if (!emuApi) return undefined;
    if (cachedDescriptors && cachedDescriptorsMachineId === machineId) {
      setDescriptors(cachedDescriptors);
      return undefined;
    }
    let live = true;
    emuApi
      .getNextRegDescriptors()
      .then((response) => {
        const table: Record<number, NextRegDescriptor> = {};
        response.descriptors.forEach((d) => {
          table[d.id] = d;
        });
        cachedDescriptors = table;
        cachedDescriptorsMachineId = machineId;
        if (live) setDescriptors(table);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [emuApi, machineId]);

  return descriptors;
}

export type NextRegSnapshot = {
  lastRegisterIndex?: number;
  regs?: RegValueState[];
  baseline?: NextRegBaseline;
};

// --- The stops the baseline is taken from (see the header comment)
let lastStop: { machineId?: string; tacts: number; baseline: NextRegBaseline } | undefined;
let stopBefore: NextRegBaseline | undefined;

/** Forgets the stops; for tests. */
export function resetNextRegStops(): void {
  lastStop = undefined;
  stopBefore = undefined;
}

/** The registers' state, refreshed with the machine, and the baseline to mark changes against. */
export function useNextRegState(): NextRegSnapshot {
  const emuApi = useEmuApi();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const [snapshot, setSnapshot] = useState<NextRegSnapshot>({});
  const machineIdRef = useRef(machineId);
  machineIdRef.current = machineId;

  // --- `useCallback`: `useEmuStateListener` keys its subscription on the callback's identity
  const refresh = useCallback(
    async (machineState: MachineControllerState) => {
      const response = await emuApi.getNextRegState();
      const currentMachine = machineIdRef.current;
      if (lastStop && lastStop.machineId !== currentMachine) resetNextRegStops();
      let baseline: NextRegBaseline | undefined;
      if (machineState === MachineControllerState.Paused) {
        const { tacts } = await emuApi.getCpuStateChunk();
        if (lastStop?.tacts !== tacts) {
          stopBefore = lastStop?.baseline;
          lastStop = { machineId: currentMachine, tacts, baseline: baselineOf(response.regs) };
        }
        baseline = stopBefore;
      } else {
        baseline = lastStop?.baseline;
      }
      setSnapshot({ lastRegisterIndex: response.lastRegisterIndex, regs: response.regs, baseline });
    },
    [emuApi]
  );

  useEmuStateListener(emuApi, refresh);
  return snapshot;
}
