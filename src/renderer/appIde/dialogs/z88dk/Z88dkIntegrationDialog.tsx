import { useEffect, useMemo, useRef } from "react";

import { useT } from "@common/i18n/useT";
import { Modal } from "@controls/Modal";
import { useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";
import { useConfirmPort, useFilePickerPort } from "@mvc/dialogs/useDialogPorts";

import { Z88dkController } from "./Z88dkController";
import { hostPlatformOf, readZ88dkEnvironment } from "./Z88dkModel";
import type { TickerPort, Z88dkIntegrationDialogResult, Z88dkPorts } from "./Z88dkPorts";
import { Z88dkIntegrationView } from "./Z88dkIntegrationView";

export type { Z88dkIntegrationDialogResult } from "./Z88dkPorts";

type Props = {
  onClose: (result: Z88dkIntegrationDialogResult) => void;
};

const intervalTicker: TickerPort = {
  start: (intervalMs, tick) => {
    const handle = setInterval(tick, intervalMs);
    return () => clearInterval(handle);
  }
};

/**
 * Wiring only: Redux state in, ports built from the renderer services, and the modal frame around
 * the view. Every decision lives in the controller and the model, which run without React.
 */
export const Z88dkIntegrationDialog = ({ onClose }: Props) => {
  const t = useT();
  const mainApi = useMainApi();
  const files = useFilePickerPort();
  const confirm = useConfirmPort();

  const { userSettings, projectSettings, isWindows, isKliveProject } = useSelector((state) => ({
    userSettings: state.userSettings,
    projectSettings: state.projectSettings,
    isWindows: state.isWindows ?? false,
    isKliveProject: state.project?.isKliveProject ?? false
  }));
  const env = useMemo(
    () =>
      readZ88dkEnvironment(
        userSettings,
        projectSettings,
        hostPlatformOf(isWindows, typeof navigator === "undefined" ? undefined : navigator.platform),
        isKliveProject
      ),
    [userSettings, projectSettings, isWindows, isKliveProject]
  );

  // --- The controller keeps its ports for its lifetime, so the callback is read through a ref
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const ports = useMemo<Z88dkPorts>(
    () => ({
      files,
      confirm,
      close: { close: (result) => onCloseRef.current(result) },
      ticker: intervalTicker,
      service: {
        probePath: (path) => mainApi.probeZ88dkPath(path),
        getPathSuggestions: () => mainApi.getZ88dkPathSuggestions(),
        listReleases: (request) => mainApi.listZ88dkReleases(request),
        downloadRelease: (request) => mainApi.downloadZ88dkRelease(request),
        getDownloadProgress: () => mainApi.getZ88dkDownloadProgress(),
        cancelDownload: () => mainApi.cancelZ88dkDownload(),
        getDefaultDownloadFolder: () => mainApi.getZ88dkDefaultDownloadFolder(),
        validateInstall: (root) => mainApi.validateZ88dkInstall(root),
        apply: (request) => mainApi.applyZ88dkIntegration(request)
      }
    }),
    [confirm, files, mainApi]
  );

  const controller = useController(() => new Z88dkController(ports, env));
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "opened" });
  }, [controller]);

  useEffect(() => {
    void controller.dispatch({ type: "environmentChanged", env });
  }, [controller, env]);

  return (
    <Modal
      title={t("dialog.z88dk.title")}
      iconName="tools"
      isOpen={true}
      fullScreen={false}
      width={680}
      primaryLabel={t("dialog.z88dk.button.apply")}
      primaryEnabled={vm.buttons.applyEnabled}
      secondaryLabel={t("dialog.z88dk.button.testAgain")}
      secondaryVisible={true}
      secondaryEnabled={vm.buttons.testEnabled}
      cancelLabel={t("common.button.close")}
      initialFocus="primary"
      closeOnOutsideClick={false}
      onClose={() => {
        void controller.dispatch({ type: "closeRequested" });
      }}
      onCancelClicked={async () => {
        // --- Returning true keeps the modal open; the controller decides
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
      <Z88dkIntegrationView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
