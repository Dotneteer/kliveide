import { useEffect, useMemo, useRef } from "react";

import { PANE_ID_BUILD } from "@common/integration/constants";
import { incProjectFileVersionAction, setExportDialogInfoAction } from "@common/state/actions";
import { Modal } from "@controls/Modal";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";
import { useFilePickerPort } from "@mvc/dialogs/useDialogPorts";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useDispatch, useRendererContext } from "@renderer/core/RendererProvider";

import { ExportCodeController } from "./ExportCodeController";
import type { ExportCodeEnvironment } from "./ExportCodeModel";
import type { ExportCodeDialogResult, ExportCodePorts } from "./ExportCodePorts";
import { ExportCodeView } from "./ExportCodeView";

export type { ExportCodeDialogResult } from "./ExportCodePorts";

type Props = {
  onClose: () => void;
  onExport?: (result: ExportCodeDialogResult) => Promise<void> | void;
};

/**
 * Wiring only: services in, ports built from them, and the modal frame around
 * the view.
 */
export const ExportCodeDialog = ({ onClose, onExport }: Props) => {
  const dispatch = useDispatch();
  const { store } = useRendererContext();
  const mainApi = useMainApi();
  const files = useFilePickerPort();
  const { outputPaneService, ideCommandsService, validationService } = useAppServices();

  // --- Read once, at open: the dialog owns these settings while it is up, and
  // --- re-seeding from the store mid-edit would fight the user.
  const savedRef = useRef(store.getState()?.project?.exportSettings ?? {});

  const env = useMemo<ExportCodeEnvironment>(
    () => ({ validation: validationService }),
    [validationService]
  );

  const callbacksRef = useRef({ onClose, onExport });
  callbacksRef.current = { onClose, onExport };

  const ports = useMemo<ExportCodePorts>(
    () => ({
      files,
      close: {
        exported: async (result) => {
          await callbacksRef.current.onExport?.(result);
          callbacksRef.current.onClose();
        },
        cancelled: () => callbacksRef.current.onClose()
      },
      service: {
        persistSettings: async (settings) => {
          dispatch(setExportDialogInfoAction(settings));
          await mainApi.saveProject();
          dispatch(incProjectFileVersionAction());
        },
        runExport: async (command) => {
          const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
          return await ideCommandsService.executeCommand(command, buildPane);
        },
        notify: (type, title, message) => mainApi.displayMessageBox(type, title, message)
      }
    }),
    [dispatch, files, ideCommandsService, mainApi, outputPaneService]
  );

  const controller = useController(
    () => new ExportCodeController(ports, env, savedRef.current)
  );
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "opened" });
  }, [controller]);

  useEffect(() => {
    void controller.dispatch({ type: "environmentChanged", env });
  }, [controller, env]);

  return (
    <Modal
      title="Export Code"
      isOpen={true}
      fullScreen={false}
      width={500}
      translateY={0}
      footerVisible={false}
      onClose={() => {
        void controller.dispatch({ type: "cancelRequested" });
      }}
    >
      <ExportCodeView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
