import { useEffect, useMemo, useRef } from "react";

import { Modal } from "@controls/Modal";
import { useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";
import { useConfirmPort, useFilePickerPort } from "@mvc/dialogs/useDialogPorts";

import { SjasmplusController } from "./SjasmplusController";
import { readSjasmplusEnvironment } from "./SjasmplusModel";
import type { SjasmplusIntegrationDialogResult, SjasmplusPorts } from "./SjasmplusPorts";
import { SjasmplusIntegrationView } from "./SjasmplusIntegrationView";

export type { SjasmplusIntegrationDialogResult } from "./SjasmplusPorts";

type Props = {
  onClose: (result: SjasmplusIntegrationDialogResult) => void;
};

/**
 * Wiring only: Redux state in, ports built from the renderer services, and the
 * modal frame around the view. Every decision lives in the controller and the
 * model, both of which run without React.
 */
export const SjasmplusIntegrationDialog = ({ onClose }: Props) => {
  const mainApi = useMainApi();
  const files = useFilePickerPort();
  const confirm = useConfirmPort();

  // --- Selected as separate primitives so the shallow-equal selector can do its
  // --- job; the environment object itself is memoized from them.
  const { userSettings, projectSettings, isWindows, isKliveProject } = useSelector((state) => ({
    userSettings: state.userSettings,
    projectSettings: state.projectSettings,
    isWindows: state.isWindows ?? false,
    isKliveProject: state.project?.isKliveProject ?? false
  }));
  const env = useMemo(
    () => readSjasmplusEnvironment(userSettings, projectSettings, isWindows, isKliveProject),
    [userSettings, projectSettings, isWindows, isKliveProject]
  );

  // --- The controller is built once and holds its ports for its lifetime, so
  // --- the callback is read through a ref: the registry passes a fresh arrow on
  // --- every render, and a captured one would go stale.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const ports = useMemo<SjasmplusPorts>(
    () => ({
      files,
      confirm,
      close: { close: (result) => onCloseRef.current(result) },
      service: {
        probePath: (path) => mainApi.probeSjasmplusPath(path),
        getPathSuggestions: () => mainApi.getSjasmplusPathSuggestions(),
        listReleases: (request) => mainApi.listSjasmplusReleases(request),
        downloadRelease: (request) => mainApi.downloadSjasmplusRelease(request),
        validateExecutable: (path) => mainApi.validateSjasmplusExecutable(path),
        apply: (request) => mainApi.applySjasmplusIntegration(request)
      }
    }),
    [confirm, files, mainApi]
  );

  // --- The controller is created with the environment it opened on; the effect
  // --- below keeps it current without rebuilding it.
  const controller = useController(() => new SjasmplusController(ports, env));
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "opened" });
  }, [controller]);

  useEffect(() => {
    void controller.dispatch({ type: "environmentChanged", env });
  }, [controller, env]);

  return (
    <Modal
      title="SJASMPLUS Integration"
      isOpen={true}
      fullScreen={false}
      width={640}
      primaryLabel="Apply"
      primaryEnabled={vm.buttons.applyEnabled}
      secondaryLabel="Test again"
      secondaryVisible={true}
      secondaryEnabled={vm.buttons.testEnabled}
      cancelLabel="Close"
      initialFocus="primary"
      closeOnOutsideClick={false}
      onClose={() => {
        void controller.dispatch({ type: "closeRequested" });
      }}
      onCancelClicked={async () => {
        // --- Returning true keeps the modal open; the controller decides.
        void controller.dispatch({ type: "closeRequested" });
        return true;
      }}
      onSecondaryClicked={async () => {
        await controller.dispatch({ type: "testAgainRequested" });
        return true;
      }}
      onPrimaryClicked={async () => {
        await controller.dispatch({ type: "applyRequested" });
        return true;
      }}
    >
      <SjasmplusIntegrationView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
