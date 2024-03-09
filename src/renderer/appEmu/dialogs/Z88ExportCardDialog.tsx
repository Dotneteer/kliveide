import { DialogRow } from "@renderer/controls/DialogRow";
import { Modal } from "@renderer/controls/Modal";

type Props = {
  slot: number;
  onClose: () => void;
};

export const Z88ExportCardDialog = ({ slot, onClose }: Props) => {
  return (
    <Modal
      isOpen={true}
      title={`Export the Content of Z88 Card in Slot ${slot}`}
      translateY={0}
      onPrimaryClicked={async () => {
        // TODO
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow>
        <div>This function is not implemented yet</div>
      </DialogRow>
    </Modal>
  );
};
