import { useEffect, useMemo, useRef } from "react";

import { Modal } from "@controls/Modal";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";
import { useFilePickerPort } from "@mvc/dialogs/useDialogPorts";

import { CreateDiskController } from "./CreateDiskController";
import type { CreateDiskEnvironment } from "./CreateDiskModel";
import type { CreateDiskDialogResult, CreateDiskPorts } from "./CreateDiskPorts";
import { CreateDiskView } from "./CreateDiskView";

export type { CreateDiskDialogResult } from "./CreateDiskPorts";

type Props = {
  onClose: () => void;
  onCreate?: (result: CreateDiskDialogResult) => void;
};

/**
 * Wiring only: services in, ports built from them, and the modal frame around
 * the view. Every decision lives in the controller and the model, both of which
 * run without React.
 */
export const CreateDiskDialog = ({ onClose, onCreate }: Props) => {
  const mainApi = useMainApi();
  const files = useFilePickerPort();
  const { validationService } = useAppServices();

  const env = useMemo<CreateDiskEnvironment>(
    () => ({ validation: validationService }),
    [validationService]
  );

  // --- The controller is built once and holds its ports for its lifetime, so
  // --- the callbacks are read through a ref: the registry passes fresh arrows
  // --- on every render, and captured ones would go stale.
  const callbacksRef = useRef({ onClose, onCreate });
  callbacksRef.current = { onClose, onCreate };

  const ports = useMemo<CreateDiskPorts>(
    () => ({
      files,
      close: {
        // --- Success settles twice on purpose, matching the old component: the
        // --- result goes to the caller, then the dialog asks to be dismissed.
        // --- DialogProvider ignores the second settle.
        created: (result) => {
          callbacksRef.current.onCreate?.(result);
          callbacksRef.current.onClose();
        },
        cancelled: () => callbacksRef.current.onClose()
      },
      service: {
        createDiskFile: (folder, filename, diskType) =>
          mainApi.createDiskFile(folder, filename, diskType),
        notify: (type, title, message) => mainApi.displayMessageBox(type, title, message)
      }
    }),
    [files, mainApi]
  );

  const controller = useController(() => new CreateDiskController(ports, env));
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "environmentChanged", env });
  }, [controller, env]);

  return (
    <Modal
      title="Create a new disk file"
      isOpen={true}
      fullScreen={false}
      translateY={0}
      width={500}
      footerVisible={false}
      onClose={() => {
        void controller.dispatch({ type: "cancelRequested" });
      }}
    >
      <CreateDiskView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
