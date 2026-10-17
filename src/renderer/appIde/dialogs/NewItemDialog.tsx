import styles from "./NewItemDialog.module.scss";
import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogForm } from "@renderer/controls/DialogForm";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { newItemName } from "./dialogValidators";
import { useState } from "react";
import { useT } from "@common/i18n/useT";

/** Stands in for the path so the translated sentence can be split around the highlighted span. */
const PATH_MARK = "\u0001";

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
  const t = useT();
  const [before, after = ""] = t(
    isFolder ? "dialog.newItem.promptFolder" : "dialog.newItem.promptFile",
    { path: PATH_MARK }
  ).split(PATH_MARK);
  const error = newItemName(validationService, itemNames, newItem);

  return (
    <DialogForm
        submitLabel={t("dialog.newItem.submit")}
        submitDisabled={Boolean(error)}
        onSubmit={() => controls.close({ name: newItem })}
        onCancel={controls.cancel}
      >
      <DialogRow rows={true}>
        <div>
          {before}
          <span className={styles.hilite}>{path}</span>
          {after}
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
