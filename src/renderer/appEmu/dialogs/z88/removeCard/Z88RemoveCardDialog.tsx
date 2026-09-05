import { useEffect, useMemo, useRef } from "react";

import { Modal } from "@renderer/controls/Modal";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";

import { useZ88Environment, useZ88MachinePort } from "../useZ88Ports";
import { Z88RemoveCardController } from "./Z88RemoveCardController";
import type { Z88RemoveCardDialogResult, Z88RemoveCardPorts } from "./Z88RemoveCardPorts";
import { Z88RemoveCardView } from "./Z88RemoveCardView";

export type { Z88RemoveCardDialogResult } from "./Z88RemoveCardPorts";

type Props = {
  slot: number;
  onClose: () => void;
  onRemove?: (result: Z88RemoveCardDialogResult) => void;
};

/**
 * Wiring only: Redux state in, ports built from the renderer services, and the
 * modal frame around the view.
 */
export const Z88RemoveCardDialog = ({ slot, onClose, onRemove }: Props) => {
  const machine = useZ88MachinePort();
  const env = useZ88Environment();

  const callbacksRef = useRef({ onClose, onRemove });
  callbacksRef.current = { onClose, onRemove };

  const ports = useMemo<Z88RemoveCardPorts>(
    () => ({
      machine,
      close: {
        removed: (result) => {
          callbacksRef.current.onRemove?.(result);
          callbacksRef.current.onClose();
        },
        dismissed: () => callbacksRef.current.onClose()
      }
    }),
    [machine]
  );

  const controller = useController(() => new Z88RemoveCardController(ports, env, slot));
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "environmentChanged", env });
  }, [controller, env]);

  return (
    <Modal
      isOpen={true}
      title="Remove Z88 Card"
      translateY={0}
      primaryEnabled={vm.removeEnabled}
      onPrimaryClicked={async () => {
        await controller.dispatch({ type: "removeRequested" });
        return true;
      }}
      onClose={() => {
        void controller.dispatch({ type: "closeRequested" });
      }}
    >
      <Z88RemoveCardView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
