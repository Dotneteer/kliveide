import { useCallback, useEffect, useRef, useState } from "react";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { NextTilemapState } from "@common/messaging/EmuApi";
import { decodeMap, tilemapMode } from "@common/zxnext/tilemap/tilemapDecode";
import { cellKeys } from "@common/zxnext/tilemap/tilemapUsage";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { tilemapStateHash } from "./tilemapViewModel";

/*
 * The Tilemap Inspector's read path (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.3, D9, T9).
 *
 * - One `getNextTilemapState()` call per refresh, at the state panels' cadence.
 * - Nothing is read while disabled. The document area mounts only the active document, so a hidden
 *   inspector is unmounted and reads nothing; `enabled` covers a non-Next machine.
 * - `version` bumps only when the hash of the 32K and the registers changes, and the snapshot object
 *   is replaced only then, so the views re-decode only then (T9).
 * - `baseline` is the cell keys (`cellKeys`) the "changed since the previous stop" markers compare
 *   with: while paused, the stop before this one; while running, the last stop.
 */

export type NextTilemapSnapshot = {
  state?: NextTilemapState;
  version: number;
  baseline?: Uint32Array;
};

export function useNextTilemapState({ enabled }: { enabled: boolean }): NextTilemapSnapshot {
  const emuApi = useEmuApi();
  const [snapshot, setSnapshot] = useState<NextTilemapSnapshot>({ version: 0 });
  const hash = useRef<number>();
  const version = useRef(0);
  const lastStop = useRef<{ tacts: number; keys: Uint32Array }>();
  const stopBefore = useRef<Uint32Array>();

  const refresh = useCallback(
    async (machineState: MachineControllerState) => {
      if (!enabled) return;
      let state: NextTilemapState;
      try {
        state = await emuApi.getNextTilemapState();
      } catch {
        // --- No machine, or not a Next: the document shows its empty state
        hash.current = undefined;
        setSnapshot((s) => (s.state ? { version: s.version } : s));
        return;
      }
      const h = tilemapStateHash(state);
      const changed = h !== hash.current;
      if (changed) {
        hash.current = h;
        version.current++;
      }
      let baseline: Uint32Array | undefined;
      if (machineState === MachineControllerState.Paused) {
        const { tacts } = await emuApi.getCpuStateChunk();
        if (lastStop.current?.tacts !== tacts) {
          stopBefore.current = lastStop.current?.keys;
          const mode = tilemapMode(state.regs);
          lastStop.current = { tacts, keys: cellKeys(decodeMap(mode, state.regs, state)) };
        }
        baseline = stopBefore.current;
      } else {
        baseline = lastStop.current?.keys;
      }
      setSnapshot((s) =>
        !changed && s.state && s.baseline === baseline ? s : { state: changed || !s.state ? state : s.state, version: version.current, baseline }
      );
    },
    [emuApi, enabled]
  );

  useEmuStateListener(emuApi, refresh, enabled);
  // --- Becoming enabled after mount reads at once
  const wasEnabled = useRef(enabled);
  useEffect(() => {
    if (enabled && !wasEnabled.current) {
      emuApi
        .getCpuStateChunk()
        .then((chunk) => refresh(chunk.state))
        .catch(() => {});
    }
    if (!enabled) {
      hash.current = undefined;
      setSnapshot((s) => (s.state ? { version: s.version } : s));
    }
    wasEnabled.current = enabled;
  }, [emuApi, enabled, refresh]);

  return snapshot;
}
