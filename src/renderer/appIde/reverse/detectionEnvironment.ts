import type { AppState } from "@common/state/AppState";
import type { IProjectService } from "@renderer/abstractions/IProjectService";
import type { DetectionContext } from "./detection";

import { bankSpaceFor } from "@common/annotations/bankSpace";
import { MF_PROFILE } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { isAdvancedDebuggingEnabled, ADVANCED_DEBUGGING_SETTING } from "@common/features/advancedDebugging";
import { profileLayoutOf } from "@common/profile/layouts";
import { isBasic48RomPage } from "@common/roms/romIdentity";
import { getActiveAnnotationSet, type ActiveAnnotationSet } from "@renderer/appIde/annotations/activeAnnotationSet";
import { getAnnotationPath } from "@renderer/appIde/annotations/programAnnotations";
import { getRomPartition } from "@renderer/appIde/annotations/romAnnotations";
import { machineConfigOf } from "@renderer/appIde/annotations/useMachineBankSpace";
import { getNexLoad } from "@renderer/appIde/DocumentPanels/Next/nexLoadSession";

/*
 * Where detection runs: the machine's bank space and profile layout, the active annotation set, the
 * ROM layers. Shared by `ann-detect` and the Detect dialog, so both see the same machine.
 */

/** Why detection cannot run on this machine now, or `undefined` when it can. */
export function detectionUnavailableReason(state: AppState | undefined): string | undefined {
  if (!isAdvancedDebuggingEnabled(state)) {
    return (
      "Detection reads code coverage, which is part of advanced debugging. Turn it on with " +
      `'set -u ${ADVANCED_DEBUGGING_SETTING} 1', then restart Klive.`
    );
  }
  const machineId = state?.emulatorState?.machineId;
  if (!machineId || !machineRegistry.find((m) => m.machineId === machineId)?.features?.[MF_PROFILE]) {
    return "This machine does not keep code coverage.";
  }
  if (!bankSpaceFor(machineId)) return "This machine's memory cannot be annotated.";
  return undefined;
}

/** The active set, or the launched NEX's sidecar when one was launched before the set existed. */
export function activeSetForEditing(): ActiveAnnotationSet | undefined {
  const active = getActiveAnnotationSet();
  if (active) return active;
  const nex = getNexLoad();
  return nex
    ? { path: getAnnotationPath(nex.path), hostPath: nex.path, machine: "next", reason: "nex-run" }
    : undefined;
}

export function detectionContextFor(
  state: AppState | undefined,
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">
): DetectionContext | undefined {
  const emu = state?.emulatorState;
  const machineId = emu?.machineId;
  const bankSpace = bankSpaceFor(machineId, machineConfigOf(machineId, emu?.modelId, emu?.config));
  const layout = profileLayoutOf(machineId);
  if (!bankSpace || !layout) return undefined;
  return {
    bankSpace,
    layout,
    activeSet: activeSetForEditing(),
    romPartition: getRomPartition,
    isBasic48Rom: (partition) => isBasic48RomPage(machineId, partition, getRomPartition(partition)?.source),
    projectService
  };
}
