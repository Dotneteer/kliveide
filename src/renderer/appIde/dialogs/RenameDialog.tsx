import styles from "./RenameDialog.module.scss";
import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogForm } from "@renderer/controls/DialogForm";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { renamedItemName } from "./dialogValidators";
import { useState } from "react";
import { useT } from "@common/i18n/useT";

/** Stands in for the old name so the translated sentence can be split around the highlighted span. */
const NAME_MARK = "\u0001";

type Props = DialogComponentProps<RenameDialogResult> & {
  oldPath: string;
};

export type RenameDialogResult = { name: string };

export const RenameDialog = ({
  oldPath,
  controls
}: Props) => {
  const { validationService } = useAppServices();
  const t = useT();
  const [before, after = ""] = t("dialog.rename.prompt", { name: NAME_MARK }).split(NAME_MARK);
  const [newPath, setNewPath] = useState(oldPath);
  const error = renamedItemName(validationService, oldPath, newPath);

  return (
    <DialogForm
        submitLabel={t("dialog.rename.submit")}
        submitDisabled={Boolean(error)}
        onSubmit={() => controls.close({ name: newPath })}
        onCancel={controls.cancel}
      >
      <DialogRow rows={true}>
        <div>
          {before}
          <span className={styles.hilite}>{oldPath}</span>
          {after}
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
