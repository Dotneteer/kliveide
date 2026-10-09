import { useMemo } from "react";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { DisassemblyOperandLabelResolver } from "@renderer/appIde/disassemblers/common-types";
import type { IProjectService } from "@renderer/abstractions/IProjectService";
import type { AppState } from "@common/state/AppState";
import type { ProgramAnnotations } from "./programAnnotations";

import { useSelector } from "@renderer/core/RendererProvider";
import { bankSpaceFor, type BankSpace } from "@common/annotations/bankSpace";
import { getActiveAnnotationSet, useActiveAnnotations } from "./activeAnnotationSet";
import { peekAnnotationSession } from "./annotationSession";
import { getRomLayerPartitions, getRomLayersOf, useRomLayersOf } from "./romAnnotations";
import {
  annotationRoutineLabels,
  buildLabelsOfCompilation,
  createAddressSymbols,
  type AddressSymbols
} from "./symbolResolver";
import type { RoutineLabel } from "@common/profile/routineMap";
import { machineConfigOf, useMachineBankSpace } from "./useMachineBankSpace";

/*
 * The shared resolver (`symbolResolver.ts`) as the views get it: rebuilt when one of its inputs
 * changes — a compilation, a session update, a machine change, a ROM identity change — and not on
 * every refresh (§4.4 of `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`).
 */

/** The file name of a path, for a tooltip. */
function fileNameOf(path: string | undefined): string | undefined {
  return path?.split(/[\\/]/).pop();
}

export type AddressSymbolsOptions = {
  /** The Disassembly view's **ROM labels** toggle; on when absent. */
  romLabels?: boolean;
  sysVarResolver?: DisassemblyOperandLabelResolver;
};

/** The resolver for the machine running now, following every input. */
export function useAddressSymbols(
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">,
  options: AddressSymbolsOptions = {}
): { symbols: AddressSymbols; bankSpace?: BankSpace; annotations?: ProgramAnnotations } {
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const compilation = useSelector((s) => s.compilation?.result) as KliveCompilerOutput | undefined;
  const { set, annotations } = useActiveAnnotations(projectService);
  const bankSpace = useMachineBankSpace();
  const romLayersOf = useRomLayersOf();
  const buildLabels = useMemo(
    () => buildLabelsOfCompilation(compilation, machineId),
    [compilation, machineId]
  );

  const symbols = useMemo(
    () =>
      createAddressSymbols({
        bankSpace,
        buildLabels,
        annotations,
        annotationOrigin: fileNameOf(set?.path),
        romLayersOf,
        romLabels: options.romLabels ?? true,
        sysVarResolver: options.sysVarResolver
      }),
    [bankSpace, buildLabels, annotations, set?.path, romLayersOf, options.romLabels, options.sysVarResolver]
  );
  return { symbols, bankSpace, annotations };
}

/**
 * The resolver for a command, which runs once: the store's compilation and machine, the active
 * set's session (a peek — a command does not subscribe), the ROM layers known now.
 */
export function addressSymbolsForState(
  state: AppState,
  options: AddressSymbolsOptions & { annotations?: ProgramAnnotations } = {}
): { symbols: AddressSymbols; bankSpace?: BankSpace } {
  const emu = state.emulatorState;
  const machineId = emu?.machineId;
  const bankSpace = bankSpaceFor(machineId, machineConfigOf(machineId, emu?.modelId, emu?.config));
  const set = getActiveAnnotationSet();
  const annotations = options.annotations ?? (set ? peekAnnotationSession(set.path) : undefined);
  const symbols = createAddressSymbols({
    bankSpace,
    buildLabels: buildLabelsOfCompilation(
      state.compilation?.result as KliveCompilerOutput | undefined,
      machineId
    ),
    annotations,
    annotationOrigin: fileNameOf(set?.path),
    romLayersOf: getRomLayersOf(),
    romLabels: options.romLabels ?? true,
    sysVarResolver: options.sysVarResolver
  });
  return { symbols, bankSpace };
}

/**
 * The active set's and the ROM's labels as the profiler's routine map takes them: routines between
 * the build's labels and the call targets (§4.4 of the plan).
 */
export function annotationRoutineLabelsForState(state: AppState): RoutineLabel[] {
  const emu = state.emulatorState;
  const machineId = emu?.machineId;
  const set = getActiveAnnotationSet();
  return annotationRoutineLabels(
    {
      annotations: set ? peekAnnotationSession(set.path) : undefined,
      bankSpace: bankSpaceFor(machineId, machineConfigOf(machineId, emu?.modelId, emu?.config)),
      romLayersOf: getRomLayersOf()
    },
    getRomLayerPartitions()
  );
}
