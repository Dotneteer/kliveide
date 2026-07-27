import styles from "./RenameDialog.module.scss";
import { Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { useState } from "react";

const VALID_FILENAME = /^[^>:"/\\|?*]+$/;

type Props = {
  isFolder?: boolean;
  oldPath: string;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
};

export const RenameDialog = ({
  isFolder,
  oldPath,
  onClose,
  onRename
}: Props) => {
  const [newPath, setNewPath] = useState(oldPath);

  const validate = (fn: string) => fn !== oldPath && VALID_FILENAME.test(fn);
  const isValid = validate(newPath);
  const submitRename = async (): Promise<boolean> => {
    if (!validate(newPath)) return true;
    await onRename?.(newPath);
    return false;
  };

  return (
    <Modal
      title={isFolder ? "Rename folder" : "Rename file"}
      isOpen={true}
      fullScreen={false}
      width={500}
      primaryLabel='Rename'
      primaryEnabled={isValid}
      initialFocus='none'
      onPrimaryClicked={submitRename}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow rows={true}>
        <div>
          Rename <span className={styles.hilite}>{oldPath}</span> to:
        </div>
        <TextInput
          value={oldPath}
          isValid={isValid}
          focusOnInit={true}
          keyPressed={async e => {
            if (e.code === "Enter") {
              if (validate(newPath)) {
                e.preventDefault();
                e.stopPropagation();
                const keepOpen = await submitRename();
                if (!keepOpen) {
                  onClose();
                }
              }
            }
          }}
          valueChanged={val => {
            setNewPath(val);
            return false;
          }}
        />
      </DialogRow>
    </Modal>
  );
};
