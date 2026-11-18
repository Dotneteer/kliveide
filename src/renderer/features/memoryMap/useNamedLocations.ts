import { useMemo } from "react";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { RoutineLabel } from "@common/profile/routineMap";
import { useSelector, useStore } from "@renderer/core/RendererProvider";
import { annotationRoutineLabelsForState } from "@renderer/appIde/annotations/useAddressSymbols";
import { buildLabelsOfCompilation } from "@renderer/appIde/annotations/symbolResolver";

/*
 * Every named location Go to and Find accept (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §4.1):
 * the build's labels, then the active annotation set's and the ROM's - the sources the shared
 * resolver reads. `version` is anything that changes when the annotations do (the resolver's
 * identity), so the list follows them.
 */
export function useNamedLocations(version: unknown): RoutineLabel[] {
  const store = useStore();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const compilation = useSelector((s) => s.compilation?.result) as KliveCompilerOutput | undefined;
  return useMemo(
    () => {
      const build = buildLabelsOfCompilation(compilation, machineId);
      let annotations: RoutineLabel[] = [];
      try {
        annotations = annotationRoutineLabelsForState(store.getState());
      } catch {
        // --- No machine yet: the build's labels only
      }
      return [...build, ...annotations];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, machineId, compilation, version]
  );
}
