import styles from "./DeleteDialog.module.scss";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogForm } from "@renderer/controls/DialogForm";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { useT } from "@common/i18n/useT";

/** Stands in for the entry name so the translated sentence can be split around the highlighted span. */
const NAME_MARK = "\u0001";

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
  const t = useT();
  const [before, after = ""] = t(
    isFolder ? "dialog.delete.confirmFolder" : "dialog.delete.confirmFile",
    { name: NAME_MARK }
  ).split(NAME_MARK);
  return (
    <DialogForm
      submitLabel={t("dialog.delete.submit")}
      submitDanger
      onSubmit={() => controls.close(true)}
      onCancel={controls.cancel}
    >
      <DialogRow>
        <div className={styles.message}>
          {before}
          <span className={styles.hilite}>{entry}</span>
          {after}
        </div>
      </DialogRow>
    </DialogForm>
  );
};
