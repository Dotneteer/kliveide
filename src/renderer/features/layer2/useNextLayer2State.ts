import { useCallback, useEffect, useRef, useState } from "react";
import type { NextLayer2State } from "@common/messaging/EmuApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { layer2StateHash } from "./layer2ViewModel";

/*
 * The Layer 2 Inspector's read path (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.3, D9, T9).
 *
 * - One `getNextLayer2State()` call per refresh, at the state panels' cadence.
 * - Nothing is read while disabled. The document area mounts only the active document, so a hidden
 *   inspector is unmounted and reads nothing; `enabled` covers a non-Next machine.
 * - The shadow banks are copied only while `shadow` is set (T9); turning it on reads at once.
 * - `version` bumps only when the hash of the banks and registers changes, and the snapshot object is
 *   replaced only then, so the views re-decode only then (D9).
 */

export type NextLayer2Snapshot = {
  state?: NextLayer2State;
  version: number;
};

export function useNextLayer2State({ enabled, shadow }: { enabled: boolean; shadow: boolean }): NextLayer2Snapshot {
  const emuApi = useEmuApi();
  const [snapshot, setSnapshot] = useState<NextLayer2Snapshot>({ version: 0 });
  const hash = useRef<number>();
  const version = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    let state: NextLayer2State;
    try {
      state = await emuApi.getNextLayer2State({ shadow });
    } catch {
      // --- No machine, or not a Next: the document shows its empty state
      hash.current = undefined;
      setSnapshot((s) => (s.state ? { version: s.version } : s));
      return;
    }
    const h = layer2StateHash(state);
    if (h === hash.current) return;
    hash.current = h;
    version.current++;
    setSnapshot({ state, version: version.current });
  }, [emuApi, enabled, shadow]);

  useEmuStateListener(emuApi, refresh, enabled);

  // --- Becoming enabled, or starting to want the shadow banks, reads at once
  const last = useRef({ enabled, shadow });
  useEffect(() => {
    const before = last.current;
    last.current = { enabled, shadow };
    if (!enabled) {
      hash.current = undefined;
      setSnapshot((s) => (s.state ? { version: s.version } : s));
      return;
    }
    if (!before.enabled || (shadow && !before.shadow)) void refresh();
  }, [enabled, shadow, refresh]);

  return snapshot;
}
