import styles from "./NewItemDialog.module.scss";
import { Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { useState } from "react";

const VALID_FILENAME = /^[^>:"/\\|?*]+$/;

type Props = {
  isFolder?: boolean;
  path: string;
  itemNames: string[];
  onClose: () => void;
  onAdd: (newName: string) => Promise<void>;
};

export const NewItemDialog = ({
  isFolder,
  path,
  itemNames,
  onClose,
  onAdd
}: Props) => {
  const [newItem, setNewItem] = useState("");
  const subject = isFolder ? "folder" : "file";

  const validate = (fn: string) =>
    !itemNames.some(item => fn === item) && VALID_FILENAME.test(fn);
  const isValid = validate(newItem);
  const submitNewItem = async (): Promise<boolean> => {
    if (!validate(newItem)) return true;
    await onAdd?.(newItem);
    return false;
  };

  return (
    <Modal
      title={`Add new ${subject}`}
      isOpen={true}
      fullScreen={false}
      width={500}
      primaryLabel='Add'
      primaryEnabled={isValid}
      initialFocus='none'
      onPrimaryClicked={submitNewItem}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow rows={true}>
        <div>
          {`Name of the new ${subject} to create in `}
          <span className={styles.hilite}>{path}</span>:
        </div>
        <TextInput
          value={""}
          isValid={isValid}
          focusOnInit={true}
          keyPressed={async e => {
            if (e.code === "Enter") {
              if (validate(newItem)) {
                e.preventDefault();
                e.stopPropagation();
                const keepOpen = await submitNewItem();
                if (!keepOpen) {
                  onClose();
                }
              }
            }
          }}
          valueChanged={val => {
            setNewItem(val);
            return false;
          }}
        />
      </DialogRow>
    </Modal>
  );
};
