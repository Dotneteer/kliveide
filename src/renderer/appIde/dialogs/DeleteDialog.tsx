import styles from "./DeleteDialog.module.scss";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogForm } from "@renderer/controls/DialogForm";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";

type Props = DialogComponentProps<true> & {
  isFolder?: boolean;
  entry: string;
};

/*
 * `isFolder` is used here and removed from `RenameDialog`, and the difference is the point.
 *
 * Both dialogs were passed the flag by `ExplorerPanel` and neither read it. Renaming a folder and
 * renaming a file have the same consequence, so there the flag was genuinely dead. Deleting them
 * does not: a folder takes everything inside it, and that is worth saying before the user confirms.
 */
export const DeleteDialog = ({ entry, isFolder, controls }: Props) => {
  return (
    <DialogForm
      submitLabel="Delete"
      submitDanger
      onSubmit={() => controls.close(true)}
      onCancel={controls.cancel}
    >
      <DialogRow>
        <div className={styles.message}>
          Are you sure you want to delete the {isFolder ? "folder" : "file"}{" "}
          <span className={styles.hilite}>{entry}</span>
          {isFolder ? " and everything in it?" : "?"}
        </div>
      </DialogRow>
    </DialogForm>
  );
};
