import styles from "./RenameDialog.module.scss";
import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogForm } from "@renderer/controls/DialogForm";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { renamedItemName } from "./dialogValidators";
import { useState } from "react";

type Props = DialogComponentProps<RenameDialogResult> & {
  isFolder?: boolean;
  oldPath: string;
};

export type RenameDialogResult = { name: string };

export const RenameDialog = ({
  isFolder,
  oldPath,
  controls
}: Props) => {
  const { validationService } = useAppServices();
  const [newPath, setNewPath] = useState(oldPath);
  const error = renamedItemName(validationService, oldPath, newPath);

  return (
    <DialogForm
        submitLabel="Rename"
        submitDisabled={Boolean(error)}
        onSubmit={() => controls.close({ name: newPath })}
        onCancel={controls.cancel}
      >
      <DialogRow rows={true}>
        <div>
          Rename <span className={styles.hilite}>{oldPath}</span> to:
        </div>
        <TextInput
          value={newPath}
          error={error}
          autoFocus={true}
          onChange={setNewPath}
        />
      </DialogRow>
    </DialogForm>
  );
};
