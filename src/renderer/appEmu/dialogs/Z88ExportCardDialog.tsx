import { DialogRow } from "@renderer/controls/DialogRow";
import { Modal } from "@renderer/controls/Modal";

type Props = {
  slot: number;
  onClose: () => void;
  onExport?: (result: Z88ExportCardDialogResult) => void;
};

export type Z88ExportCardDialogResult = {
  slot: number;
};

export const Z88ExportCardDialog = ({ slot, onClose, onExport }: Props) => {
  return (
    <Modal
      isOpen={true}
      title={`Export the Content of Z88 Card in Slot ${slot}`}
      width={420}
      translateY={0}
      onPrimaryClicked={async () => {
        // TODO
        onExport?.({ slot });
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
