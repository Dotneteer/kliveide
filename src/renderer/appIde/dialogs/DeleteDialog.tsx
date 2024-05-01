import styles from "./DeleteDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { DialogRow } from "@renderer/controls/DialogRow";
import { useRef } from "react";

type Props = {
  isFolder?: boolean;
  entry: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
};

export const DeleteDialog = ({ isFolder, entry, onClose, onDelete }: Props) => {
  const modalApi = useRef<ModalApi>(null);

  return (
    <Modal
      title={isFolder ? "Delete folder" : "Delete file"}
      isOpen={true}
      fullScreen={false}
      width={500}
      onApiLoaded={api => (modalApi.current = api)}
      primaryLabel='Delete'
      primaryDanger={true}
      initialFocus='cancel'
      onPrimaryClicked={async () => {
        await onDelete?.();
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow>
        <div>
          Are you sure you want to delete{" "}
          <span className={styles.hilite}>{entry}</span>?
        </div>
      </DialogRow>
    </Modal>
  );
};
