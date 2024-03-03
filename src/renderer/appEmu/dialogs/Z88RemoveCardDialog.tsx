import { DialogRow } from "@renderer/controls/DialogRow";
import { Modal } from "@renderer/controls/Modal";

type Props = {
  slot: number;
  onClose: () => void;
};

export const Z88RemoveCardDialog = ({ slot, onClose }: Props) => {
  return (
    <Modal
      isOpen={true}
      title='Remove Z88 Card'
      onPrimaryClicked={async () => {
        console.log("Remove card from slot", slot);
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
