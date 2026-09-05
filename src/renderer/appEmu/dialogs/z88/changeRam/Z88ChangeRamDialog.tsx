import { useEffect, useMemo, useRef } from "react";

import { Modal } from "@renderer/controls/Modal";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";

import { useZ88Environment, useZ88MachinePort, useZ88OutputPort } from "../useZ88Ports";
import { Z88ChangeRamController } from "./Z88ChangeRamController";
import type { Z88ChangeRamDialogResult, Z88ChangeRamPorts } from "./Z88ChangeRamPorts";
import { Z88ChangeRamView } from "./Z88ChangeRamView";

export type { Z88ChangeRamDialogResult } from "./Z88ChangeRamPorts";

type Props = {
  onClose: () => void;
  onChange?: (result: Z88ChangeRamDialogResult) => void;
};

/**
 * Wiring only: Redux state in, ports built from the renderer services, and the
 * modal frame around the view.
 */
export const Z88ChangeRamDialog = ({ onClose, onChange }: Props) => {
  const machine = useZ88MachinePort();
  const output = useZ88OutputPort();
  const env = useZ88Environment();

  // --- The controller holds its ports for its lifetime, so the callbacks are
  // --- read through a ref: the registry passes fresh arrows on every render.
  const callbacksRef = useRef({ onClose, onChange });
  callbacksRef.current = { onClose, onChange };

  const ports = useMemo<Z88ChangeRamPorts>(
    () => ({
      machine,
      output,
      close: {
        // --- The result goes to the caller and the dialog then asks to be
        // --- dismissed, which is what the old component's `return false` from
        // --- the Modal's primary handler did.
        settled: (result) => {
          callbacksRef.current.onChange?.(result);
          callbacksRef.current.onClose();
        },
        dismissed: () => callbacksRef.current.onClose()
      }
    }),
    [machine, output]
  );

  const controller = useController(() => new Z88ChangeRamController(ports, env));
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "environmentChanged", env });
  }, [controller, env]);

  return (
    <Modal
      isOpen={true}
      title="Change Z88 RAM size"
      width={300}
      translateY={0}
      primaryEnabled={vm.applyEnabled}
      onPrimaryClicked={async () => {
        // --- Returning true keeps the modal open; the controller decides when
        // --- the dialog is done, so a failed rebuild leaves it on screen.
        await controller.dispatch({ type: "applyRequested" });
        return true;
      }}
      onClose={() => {
        void controller.dispatch({ type: "closeRequested" });
      }}
    >
      <Z88ChangeRamView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
