import { DialogRow } from "@renderer/controls/DialogRow";
import { Modal } from "@renderer/controls/Modal";
import { CardSlotState, applyCardStateChange } from "../machines/Z88ToolArea";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { MC_Z88_SLOT0 } from "@common/machines/constants";

type Props = {
  slot: number;
  onClose: () => void;
};

export const Z88RemoveCardDialog = ({ slot, onClose }: Props) => {
  const { store } = useRendererContext();
  const { machineService } = useAppServices();
  const machine = machineService.getMachineController().machine as IZ88Machine;
  return (
    <Modal
      isOpen={true}
      title='Remove Z88 Card'
      translateY={0}
      onPrimaryClicked={async () => {
        const slotState: CardSlotState = {
          cardType: "-"
        };
        await applyCardStateChange(
          store,
          machineService.getMachineController(),
          `slot${slot}` as any,
          slotState
        );
        if (!slot) {
          // --- Slot 0: Require a restart
          const emulatorState = store.getState().emulatorState;
          const machineConfig = emulatorState.config ?? {};
          const newConfig = { ...machineConfig, [MC_Z88_SLOT0]: slotState };
          console.log(newConfig);
          const machineId = emulatorState?.machineId;
          const modelId = emulatorState?.modelId;

          // --- Change the configuration
          await machineService.setMachineType(machineId, modelId, newConfig);
        }
        return false;
      }}
      onClose={() => {
        machine.signalFlapClosed();
        onClose();
      }}
    >
      <DialogRow>
        <div>Are you sure you want to remove card from Slot {slot}?</div>
      </DialogRow>
    </Modal>
  );
};
