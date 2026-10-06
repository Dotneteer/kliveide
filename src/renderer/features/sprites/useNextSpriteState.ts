import { useCallback, useEffect, useRef, useState } from "react";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { NextSpriteState } from "@common/messaging/EmuApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { hashBytes } from "./spriteViewModel";

/*
 * The Sprite Inspector's read path (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.3, D9, T9).
 *
 * - One `getNextSpriteState()` call per refresh, at the state panels' cadence.
 * - Nothing is read while disabled. The document area mounts only the active document, so a hidden
 *   Sprite Inspector is unmounted and reads nothing; `enabled` covers a non-Next machine.
 * - `patternsVersion` bumps only when the 16K pattern RAM's hash changes, so the sheet re-decodes
 *   its canvases only then.
 * - `baseline` is the attribute bytes the "changed since the previous stop" markers compare with
 *   (D16): while paused, the stop before this one; while running, the last stop.
 */

export type NextSpriteSnapshot = {
  state?: NextSpriteState;
  patternsVersion: number;
  baseline?: Uint8Array;
};

export function useNextSpriteState({ enabled }: { enabled: boolean }): NextSpriteSnapshot {
  const emuApi = useEmuApi();
  const [snapshot, setSnapshot] = useState<NextSpriteSnapshot>({ patternsVersion: 0 });
  const patternsHash = useRef<number>();
  const version = useRef(0);
  const lastStop = useRef<{ tacts: number; attributes: Uint8Array }>();
  const stopBefore = useRef<Uint8Array>();

  const refresh = useCallback(
    async (machineState: MachineControllerState) => {
      if (!enabled) return;
      let state: NextSpriteState;
      try {
        state = await emuApi.getNextSpriteState();
      } catch {
        // --- No machine, or not a Next: the document shows its empty state
        setSnapshot((s) => (s.state ? { patternsVersion: s.patternsVersion } : s));
        return;
      }
      const hash = hashBytes(state.patterns);
      if (hash !== patternsHash.current) {
        patternsHash.current = hash;
        version.current++;
      }
      let baseline: Uint8Array | undefined;
      if (machineState === MachineControllerState.Paused) {
        const { tacts } = await emuApi.getCpuStateChunk();
        if (lastStop.current?.tacts !== tacts) {
          stopBefore.current = lastStop.current?.attributes;
          lastStop.current = { tacts, attributes: state.attributes };
        }
        baseline = stopBefore.current;
      } else {
        baseline = lastStop.current?.attributes;
      }
      setSnapshot({ state, patternsVersion: version.current, baseline });
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
    if (!enabled) setSnapshot((s) => (s.state ? { patternsVersion: s.patternsVersion } : s));
    wasEnabled.current = enabled;
  }, [emuApi, enabled, refresh]);

  return snapshot;
}
