import { DialogRow } from "@renderer/controls/DialogRow";
import { Modal } from "@renderer/controls/Modal";
import { CardSlotState, applyCardStateChange } from "../machines/Z88ToolArea";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";

type Props = {
  slot: number;
  onClose: () => void;
};

export const Z88RemoveCardDialog = ({ slot, onClose }: Props) => {
  const { store } = useRendererContext();
  const { machineService } = useAppServices();
  return (
    <Modal
      isOpen={true}
      title='Remove Z88 Card'
      translateY={0}
      onPrimaryClicked={async () => {
        const slotState: CardSlotState = {
          cardType: "-"
        };
        applyCardStateChange(
          store,
          machineService.getMachineController(),
          `slot${slot}` as any,
          slotState
        );
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow>
        <div>Are you sure you want to remove card from Slot {slot}?</div>
      </DialogRow>
    </Modal>
  );
};
