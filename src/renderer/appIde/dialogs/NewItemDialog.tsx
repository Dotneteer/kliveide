import styles from "./NewItemDialog.module.scss";
import { Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogForm } from "@renderer/controls/DialogForm";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { newItemName } from "./dialogValidators";
import { useState } from "react";

type Props = DialogComponentProps<NewItemDialogResult> & {
  isFolder?: boolean;
  path: string;
  itemNames: string[];
};

export type NewItemDialogResult = { name: string };

export const NewItemDialog = ({
  isFolder,
  path,
  itemNames,
  controls
}: Props) => {
  const { validationService } = useAppServices();
  const [newItem, setNewItem] = useState("");
  const subject = isFolder ? "folder" : "file";
  const error = newItemName(validationService, itemNames, newItem);

  return (
    <DialogForm
        submitLabel="Add"
        submitDisabled={Boolean(error)}
        onSubmit={() => controls.close({ name: newItem })}
        onCancel={controls.cancel}
      >
      <DialogRow rows={true}>
        <div>
          {`Name of the new ${subject} to create in `}
          <span className={styles.hilite}>{path}</span>:
        </div>
        <TextInput
          value={newItem}
          error={error}
          autoFocus={true}
          onChange={setNewItem}
        />
      </DialogRow>
    </DialogForm>
  );
};
