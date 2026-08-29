import styles from "./DeleteDialog.module.scss";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogForm } from "@renderer/controls/DialogForm";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";

type Props = DialogComponentProps<true> & {
  isFolder?: boolean;
  entry: string;
};

export const DeleteDialog = ({ entry, controls }: Props) => {
  return (
    <DialogForm
      submitLabel="Delete"
      submitDanger
      onSubmit={() => controls.close(true)}
      onCancel={controls.cancel}
    >
      <DialogRow>
        <div className={styles.message}>
          Are you sure you want to delete{" "}
          <span className={styles.hilite}>{entry}</span>?
        </div>
      </DialogRow>
    </DialogForm>
  );
};
