import { useCallback, useRef, useState } from "react";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { PaletteDeviceInfo, PaletteWriteEvent } from "@common/messaging/EmuApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";

import { readNextPalette } from "./nextPaletteRead";

/*
 * The Palette document's read path (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §4): the palettes
 * (read only when their version moved, §5), the palettes at the previous stop - what the "old
 * colour" corner of a written entry shows - and the palette write a `pal:` breakpoint stopped on.
 *
 * The stops are kept at module level, as `useNextRegState` keeps its own: the document area
 * unmounts a document that is not active, and switching tabs must not forget the previous stop.
 */

export type NextPaletteSnapshot = {
  info?: PaletteDeviceInfo;
  /** The palettes at the stop before this one while paused; at the last stop while running */
  baseline?: PaletteDeviceInfo;
  /** The write a `pal:` breakpoint stopped on, while paused there */
  lastWrite?: PaletteWriteEvent;
  /** Changes with every new stop, so Follow moves once per stop */
  stopId?: number;
  paused: boolean;
};

let lastStop: { machineId?: string; tacts: number; info: PaletteDeviceInfo } | undefined;
let stopBefore: PaletteDeviceInfo | undefined;

/** Forgets the stops; for tests. */
export function resetNextPaletteStops(): void {
  lastStop = undefined;
  stopBefore = undefined;
}

export function useNextPaletteState(): NextPaletteSnapshot {
  const emuApi = useEmuApi();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const machineIdRef = useRef(machineId);
  machineIdRef.current = machineId;
  const lastInfo = useRef<PaletteDeviceInfo | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<NextPaletteSnapshot>({ paused: false });

  const refresh = useCallback(
    async (machineState: MachineControllerState) => {
      let info: PaletteDeviceInfo;
      try {
        info = await readNextPalette(emuApi, lastInfo.current);
      } catch {
        // --- Not a Next (yet): nothing to show
        lastInfo.current = undefined;
        setSnapshot({ paused: false });
        return;
      }
      lastInfo.current = info;
      const currentMachine = machineIdRef.current;
      if (lastStop && lastStop.machineId !== currentMachine) resetNextPaletteStops();
      if (machineState === MachineControllerState.Paused) {
        const cpu = await emuApi.getCpuState();
        const tacts = cpu?.tacts ?? 0;
        if (lastStop?.tacts !== tacts) {
          stopBefore = lastStop?.info;
          lastStop = { machineId: currentMachine, tacts, info };
        } else {
          // --- The same stop, read again (an edit, a restore): keep the newest palettes
          lastStop.info = info;
        }
        const lastWrite = cpu && "lastPaletteWrite" in cpu ? (cpu.lastPaletteWrite as PaletteWriteEvent) : undefined;
        setSnapshot({ info, baseline: stopBefore, lastWrite, stopId: tacts, paused: true });
      } else {
        setSnapshot({ info, baseline: lastStop?.info, paused: false });
      }
    },
    [emuApi]
  );
  useEmuStateListener(emuApi, refresh);
  return snapshot;
}
