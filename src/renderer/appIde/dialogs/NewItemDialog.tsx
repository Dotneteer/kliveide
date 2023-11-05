import styles from "./NewItemDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { useRef, useState } from "react";

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
  const modalApi = useRef<ModalApi>(null);
  const [newItem, setNewItem] = useState("");
  const subject = isFolder ? "folder" : "file";

  const validate = (fn: string) =>
    !itemNames.some(item => fn === item) && VALID_FILENAME.test(fn);
  const isValid = validate(newItem);

  return (
    <Modal
      title={`Add new ${subject}`}
      isOpen={true}
      fullScreen={false}
      width={500}
      onApiLoaded={api => (modalApi.current = api)}
      primaryLabel='Add'
      primaryEnabled={isValid}
      initialFocus='none'
      onPrimaryClicked={async result => {
        await onAdd?.(result ?? newItem);
        return false;
      }}
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
          keyPressed={e => {
            if (e.code === "Enter") {
              if (validate(newItem)) {
                modalApi.current.triggerPrimary(newItem);
              }
            }
          }}
          valueChanged={val => {
            setNewItem(val);
            modalApi.current.enablePrimaryButton(validate(val));
            return false;
          }}
        />
      </DialogRow>
    </Modal>
  );
};
