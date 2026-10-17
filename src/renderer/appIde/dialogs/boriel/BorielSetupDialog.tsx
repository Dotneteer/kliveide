import { useEffect, useMemo, useRef } from "react";

import { Modal } from "@controls/Modal";
import { useMainApi } from "@renderer/core/MainApi";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";
import { useFilePickerPort } from "@mvc/dialogs/useDialogPorts";

import { BorielSetupController } from "./BorielSetupController";
import type { BorielSetupMode } from "./BorielSetupModel";
import type { BorielSetupDialogResult, BorielSetupPorts } from "./BorielSetupPorts";
import { BorielSetupView } from "./BorielSetupView";

export type { BorielSetupDialogResult } from "./BorielSetupPorts";

type Props = {
  /** "offer" at the first start after a kit is bundled, "settings" from Settings › Integrations. */
  mode?: BorielSetupMode;
  onClose: (result: BorielSetupDialogResult) => void;
};

/**
 * Wiring only: ports built from the renderer services, and the modal frame around the view.
 * Every decision lives in the controller and the model.
 */
export const BorielSetupDialog = ({ mode = "settings", onClose }: Props) => {
  const mainApi = useMainApi();
  const files = useFilePickerPort();

  // --- The controller keeps its ports for its lifetime; read the callback through a ref
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const ports = useMemo<BorielSetupPorts>(
    () => ({
      files,
      close: { close: (result) => onCloseRef.current(result) },
      service: {
        getStatus: () => mainApi.getBorielSetupStatus(),
        install: (folder) => mainApi.installBoriel(folder),
        useExisting: (itemPath) => mainApi.useExistingBoriel(itemPath),
        recordDecision: (decision) => mainApi.recordBorielSetupDecision(decision),
        setCompiler: (choice) => mainApi.setBasicCompiler(choice)
      }
    }),
    [files, mainApi]
  );

  const controller = useController(() => new BorielSetupController(ports, mode));
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "opened" });
  }, [controller]);

  return (
    <Modal
      title="Boriel BASIC"
      iconName="tools"
      isOpen={true}
      fullScreen={false}
      width={600}
      primaryLabel={vm.primary.label}
      primaryEnabled={vm.primary.enabled}
      cancelLabel={vm.cancel.label}
      cancelEnabled={vm.cancel.enabled}
      initialFocus="primary"
      closeOnOutsideClick={false}
      onClose={() => {
        void controller.dispatch({ type: "closeRequested" });
      }}
      onCancelClicked={async () => {
        // --- Returning true keeps the modal open; the controller decides when it closes
        void controller.dispatch({ type: "closeRequested" });
        return true;
      }}
      onPrimaryClicked={async () => {
        await controller.dispatch({ type: "installRequested" });
        return true;
      }}
    >
      <BorielSetupView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
