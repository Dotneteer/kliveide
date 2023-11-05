import styles from "./RenameDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { useRef, useState } from "react";

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
  const modalApi = useRef<ModalApi>(null);
  const [newPath, setNewPath] = useState(oldPath);

  const validate = (fn: string) => fn !== oldPath && VALID_FILENAME.test(fn);
  const isValid = validate(newPath);

  return (
    <Modal
      title={isFolder ? "Rename folder" : "Rename file"}
      isOpen={true}
      fullScreen={false}
      width={500}
      onApiLoaded={api => (modalApi.current = api)}
      primaryLabel='Rename'
      primaryEnabled={isValid}
      initialFocus='none'
      onPrimaryClicked={async result => {
        await onRename?.(result ?? newPath);
        return false;
      }}
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
          keyPressed={e => {
            if (e.code === "Enter") {
              if (validate(newPath)) {
                modalApi.current.triggerPrimary(newPath);
              }
            }
          }}
          valueChanged={val => {
            setNewPath(val);
            modalApi.current.enablePrimaryButton(validate(val));
            return false;
          }}
        />
      </DialogRow>
    </Modal>
  );
};
