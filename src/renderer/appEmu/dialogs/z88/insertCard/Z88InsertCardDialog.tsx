import { useEffect, useMemo, useRef } from "react";

import { Modal } from "@renderer/controls/Modal";
import { useMainApi } from "@renderer/core/MainApi";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";

import { SLOT0 } from "./Z88InsertCardModel";
import { useZ88Environment, useZ88MachinePort } from "../useZ88Ports";
import { Z88InsertCardController } from "./Z88InsertCardController";
import {
  Z88_CARDS_FOLDER_SETTINGS_KEY,
  type Z88InsertCardDialogResult,
  type Z88InsertCardPorts
} from "./Z88InsertCardPorts";
import { Z88InsertCardView } from "./Z88InsertCardView";

export type { Z88InsertCardDialogResult } from "./Z88InsertCardPorts";

type Props = {
  slot: number;
  onClose: () => void;
  onInsert?: (result: Z88InsertCardDialogResult) => void;
};

/**
 * Wiring only: Redux state in, ports built from the renderer services, and the
 * modal frame around the view.
 */
export const Z88InsertCardDialog = ({ slot, onClose, onInsert }: Props) => {
  const mainApi = useMainApi();
  const machine = useZ88MachinePort();
  const env = useZ88Environment();

  const callbacksRef = useRef({ onClose, onInsert });
  callbacksRef.current = { onClose, onInsert };

  const ports = useMemo<Z88InsertCardPorts>(
    () => ({
      machine,
      cardFile: {
        pickCardFile: async (forSlot) =>
          // --- The internal ROM socket takes a ROM image; the card slots take
          // --- an EPROM image.
          (await mainApi.showOpenFileDialog(
            forSlot === SLOT0
              ? [
                  { name: "ROM files", extensions: ["bin", "rom"] },
                  { name: "All Files", extensions: ["*"] }
                ]
              : [
                  { name: "EPROM files", extensions: ["epr"] },
                  { name: "All Files", extensions: ["*"] }
                ],
            Z88_CARDS_FOLDER_SETTINGS_KEY
          )) || undefined,
        checkCard: (path) => mainApi.checkZ88Card(path),
        notify: (type, title, message) => mainApi.displayMessageBox(type, title, message)
      },
      close: {
        inserted: (result) => {
          callbacksRef.current.onInsert?.(result);
          callbacksRef.current.onClose();
        },
        dismissed: () => callbacksRef.current.onClose()
      }
    }),
    [machine, mainApi]
  );

  const controller = useController(() => new Z88InsertCardController(ports, env, slot));
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "environmentChanged", env });
  }, [controller, env]);

  return (
    <Modal
      isOpen={true}
      title={vm.title}
      width={438}
      translateY={0}
      primaryEnabled={vm.insertEnabled}
      onPrimaryClicked={async () => {
        // --- Returning true keeps the modal open; the controller closes it
        // --- through the port once the card is actually in.
        await controller.dispatch({ type: "insertRequested" });
        return true;
      }}
      onClose={() => {
        void controller.dispatch({ type: "closeRequested" });
      }}
    >
      <Z88InsertCardView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
