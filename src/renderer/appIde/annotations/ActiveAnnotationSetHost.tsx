import { useEffect } from "react";

import { useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { annotationMachineFor } from "@common/annotations/bankSpace";
import { useNexSidecarBreakpointSync } from "@renderer/appIde/DocumentPanels/Next/useNexBankBreakpoints";

import {
  clearActiveAnnotationSet,
  projectAnnotationPath,
  getActiveAnnotationSet,
  setActiveAnnotationSet,
  useActiveAnnotations
} from "./activeAnnotationSet";

/**
 * Keeps the active annotation set alive for the whole IDE, with or without a document open:
 *
 * - **a Klive project** makes its sidecar active when it opens, and deactivates it when it closes
 *   (only if nothing more specific — a snapshot, a launched NEX — has taken over since);
 * - **the set's own breakpoints and labels** are installed and followed: its `debug` subtree is
 *   armed, label breakpoints resolve against its labels, and its labels join the condition symbols.
 *   Before this, all of that happened only while one of a NEX's banks was popped out.
 *
 * Renders nothing.
 */
export function ActiveAnnotationSetHost() {
  const { projectService } = useAppServices();
  const folderPath = useSelector((s) => s.project?.folderPath);
  const isKliveProject = useSelector((s) => s.project?.isKliveProject ?? false);
  const projectAnnotations = useSelector((s) => s.project?.annotations);
  const machineId = useSelector((s) => s.emulatorState?.machineId);

  // --- A Klive project's own sidecar
  useEffect(() => {
    const machine = annotationMachineFor(machineId);
    if (!folderPath || !isKliveProject || !machine) {
      clearActiveAnnotationSet("project");
      return;
    }
    const current = getActiveAnnotationSet();
    // --- A program put in the machine since the project opened keeps the set it brought.
    if (current && current.reason !== "project") return;
    setActiveAnnotationSet({
      path: projectAnnotationPath(folderPath, projectAnnotations),
      machine,
      reason: "project"
    });
  }, [folderPath, isKliveProject, projectAnnotations, machineId]);

  // --- The set's breakpoints, label breakpoints and condition symbols
  const { set, annotations } = useActiveAnnotations(projectService);
  useNexSidecarBreakpointSync(set?.path, annotations);

  return null;
}
