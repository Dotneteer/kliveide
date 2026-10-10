import { useEffect, useMemo, useRef } from "react";

import { Modal } from "@controls/Modal";
import { useSelector, useRendererContext } from "@renderer/core/RendererProvider";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";
import { useConfirmPort, useFilePickerPort } from "@mvc/dialogs/useDialogPorts";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";

import { applyDetection, canUndoDetection, runDetection, undoLastDetection } from "@renderer/appIde/reverse/detection";
import { detectionContextFor, detectionUnavailableReason } from "@renderer/appIde/reverse/detectionEnvironment";
import { DetectController } from "./DetectController";
import type { DetectEnvironment } from "./DetectModel";
import type { DetectDialogResult, DetectPorts } from "./DetectPorts";
import { DetectView } from "./DetectView";
import { buildSkoolImport } from "@renderer/appIde/reverse/skoolRun";
import { useMainApi } from "@renderer/core/MainApi";

export type { DetectDialogResult } from "./DetectPorts";

type Props = {
  onClose: (result: DetectDialogResult) => void;
  /** Import this SkoolKit file instead of detecting (§6.4). */
  skoolPath?: string;
};

/**
 * *Detect code and data…* (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §4.6). Wiring only: Redux
 * state in, ports built from the renderer services. Every decision lives in the controller and the
 * model.
 */
export const DetectDialog = ({ onClose, skoolPath }: Props) => {
  const mainApi = useMainApi();
  const emuApi = useEmuApi();
  const { store } = useRendererContext();
  const { projectService, ideCommandsService } = useAppServices();
  const files = useFilePickerPort();
  const confirm = useConfirmPort();
  const { machineState, unavailable } = useSelector((state) => ({
    machineState: state.emulatorState?.machineState,
    unavailable: detectionUnavailableReason(state)
  }));
  const env = useMemo<DetectEnvironment>(
    () => ({
      unavailable: skoolPath ? undefined : unavailable,
      paused: machineState === MachineControllerState.Paused,
      canUndo: canUndoDetection(),
      ...(skoolPath ? { skoolPath } : {})
    }),
    [machineState, skoolPath, unavailable]
  );
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const ports = useMemo<DetectPorts>(() => {
    const context = () => {
      const result = detectionContextFor(store.getState(), projectService);
      if (!result) throw new Error("This machine's memory cannot be annotated.");
      return result;
    };
    return {
      detection: {
        run: async (request) =>
          skoolPath
            ? buildSkoolImport(emuApi, context(), skoolPath, await mainApi.readTextFile(skoolPath), request.mode === "replace" ? "replace" : "fill", (lines, z80n) =>
                mainApi.assembleLines(lines, z80n)
              )
            : runDetection(emuApi, context(), request),
        apply: (targets) => applyDetection(targets, context()),
        undo: () => undoLastDetection(projectService)
      },
      coverage: {
        turnOn: async () => {
          const result = await ideCommandsService.executeCommand("coverage on");
          if (!result.success) throw new Error(result.finalMessage ?? "Coverage could not be turned on.");
          return "Coverage is on. Run the program, pause, then Detect.";
        },
        load: async (path) => {
          const result = await ideCommandsService.executeCommand(`coverage load "${path}"`);
          if (!result.success) throw new Error(result.finalMessage ?? "The run could not be loaded.");
          return "The saved run is merged. Detect again.";
        }
      },
      navigate: {
        goTo: (target, offset) =>
          void ideCommandsService.executeCommand(`show-disass $${toHexa4((target.write.disassOffset + offset) & 0xffff)}`)
      },
      files,
      confirm,
      close: { close: (result) => onCloseRef.current(result) }
    };
  }, [confirm, emuApi, files, ideCommandsService, mainApi, projectService, skoolPath, store]);

  const controller = useController(() => new DetectController(ports, env));
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "opened" });
  }, [controller]);
  useEffect(() => {
    void controller.dispatch({ type: "environmentChanged", env });
  }, [controller, env]);

  return (
    <Modal
      title={skoolPath ? "Import SkoolKit file" : "Detect code and data"}
      iconName="disassembly-icon"
      isOpen={true}
      fullScreen={false}
      width={760}
      primaryLabel={vm.applyLabel}
      primaryEnabled={vm.buttons.applyEnabled}
      secondaryLabel="Undo last detection"
      secondaryVisible={true}
      secondaryEnabled={vm.buttons.undoEnabled}
      cancelLabel="Close"
      initialFocus="primary"
      closeOnOutsideClick={false}
      onClose={() => void controller.dispatch({ type: "closeRequested" })}
      onCancelClicked={async () => {
        void controller.dispatch({ type: "closeRequested" });
        return true;
      }}
      onSecondaryClicked={async () => {
        await controller.dispatch({ type: "undoRequested" });
        return true;
      }}
      onPrimaryClicked={async () => {
        await controller.dispatch({ type: "applyRequested" });
        return true;
      }}
    >
      <DetectView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
