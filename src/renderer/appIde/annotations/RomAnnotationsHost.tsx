import { useEffect, useReducer, useRef } from "react";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useMainApi } from "@renderer/core/MainApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";

import { subscribeAnnotationSession } from "./annotationSession";
import { loadRomPartitions } from "./romAnnotationLoader";
import { setRomPartitions } from "./romAnnotations";
import { mergeRomLayers } from "./symbolResolver";
import { pushConditionSymbols, setRomConditionSymbols } from "@renderer/appIde/utils/condition-symbols";

/**
 * Keeps the ROM annotations of the machine running now loaded
 * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §5.3): read again when the machine, its model or
 * configuration changes (a ROM property) or the machine starts, and whenever the user edits one of
 * its ROM pages — the user layers are sessions like any annotation file, so an edit from the live
 * view reaches the listing the way a program edit does.
 *
 * Renders nothing.
 */
export function RomAnnotationsHost() {
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const { projectService } = useAppServices();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const modelId = useSelector((s) => s.emulatorState?.modelId);
  const config = useSelector((s) => s.emulatorState?.config);
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const started =
    machineState !== undefined &&
    machineState !== null &&
    machineState !== MachineControllerState.None &&
    machineState !== MachineControllerState.Stopped;
  // --- Bumped by an edit to a user layer
  const [edits, edited] = useReducer((count: number) => count + 1, 0);

  const deps = useRef({ emuApi, mainApi, projectService });
  deps.current = { emuApi, mainApi, projectService };

  useEffect(() => {
    let cancelled = false;
    let unsubscribes: (() => void)[] = [];
    void (async () => {
      const infos = await loadRomPartitions({
        emuApi: deps.current.emuApi,
        files: deps.current.mainApi,
        projectService: deps.current.projectService,
        machineId
      });
      if (cancelled) return;
      setRomPartitions(infos);
      // --- `ROM:<name>` in conditions reads the paged ROM's labels (§5.5)
      setRomConditionSymbols(
        infos.flatMap((info) =>
          (mergeRomLayers(info.layers)?.bankAnnotation.localLabels ?? []).map((label) => ({
            name: label.name,
            address: label.value
          }))
        )
      );
      void pushConditionSymbols(deps.current.emuApi);
      // --- Follow the user layers. Only an *edit* re-reads (it publishes a new, dirty model):
      // --- the session's own loading and writing snapshots change nothing the layers hold.
      unsubscribes = [...new Set(infos.map((info) => info.userPath))].map((path) => {
        let seen: unknown;
        return subscribeAnnotationSession(deps.current.projectService, path, undefined, (snapshot) => {
          if (!snapshot.dirty || snapshot.annotations === seen) return;
          seen = snapshot.annotations;
          if (!cancelled) edited();
        });
      });
    })();
    return () => {
      cancelled = true;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [machineId, modelId, config, started, edits]);

  return null;
}
