import { DialogForm } from "@renderer/controls/DialogForm";
import { DialogRow } from "@renderer/controls/DialogRow";
import Dropdown from "@renderer/controls/Dropdown";
import { TextInput } from "@renderer/controls/TextInput";
import { useT } from "@common/i18n/useT";

import type { CreateDiskIntent } from "./CreateDiskIntents";
import type { CreateDiskViewModel } from "./CreateDiskViewModel";
import styles from "./CreateDiskDialog.module.scss";

export type CreateDiskViewProps = {
  vm: CreateDiskViewModel;
  dispatch: (intent: CreateDiskIntent) => void;
};

/**
 * The Create Disk dialog body. It renders the view model and reports what the
 * user did; every decision behind those fields belongs to the model.
 */
export const CreateDiskView = ({ vm, dispatch }: CreateDiskViewProps) => {
  const t = useT();
  return (
    <DialogForm
      submitLabel={vm.submitLabel}
      submitDisabled={!vm.submitEnabled}
      submitting={vm.submitting}
      onSubmit={() => dispatch({ type: "createRequested" })}
      onCancel={() => dispatch({ type: "cancelRequested" })}
    >
      <DialogRow rows={true} label={t("dialog.createDisk.diskType.label")}>
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder={t("dialog.createDisk.selectPlaceholder")}
            options={vm.diskType.options}
            initialValue={vm.diskType.value}
            // --- As wide as its widest label (`.ai/ui-theming-intent-and-lessons.md`, "A Dialog Field
            // --- Is As Wide As Its Widest Legal Value"), from the options themselves: the machine
            // --- picks them (CPC on the +3, TR-DOS on the Pentagon), and a fixed 200px clipped the
            // --- TR-DOS ones. The extra 4ch hold the chevron; the open list takes this width too.
            width={`${Math.max(...vm.diskType.options.map((o) => o.label.length)) + 4}ch`}
            onChanged={(diskType) => dispatch({ type: "diskTypeSelected", diskType })}
          />
        </div>
      </DialogRow>
      <DialogRow label={t("dialog.createDisk.folder.label")}>
        <div className={styles.fieldWithHint}>
          <TextInput
            value={vm.folder.value}
            error={vm.folder.error}
            autoFocus={true}
            buttonIcon="folder"
            buttonTitle={t("dialog.createDisk.folder.browseTooltip")}
            // --- The controller owns the picker, so browse reports the click and
            // --- resolves empty; the chosen folder arrives back through the view
            // --- model rather than through TextInput's own onChange.
            browse={async () => {
              dispatch({ type: "selectFolderRequested" });
              return undefined;
            }}
            onChange={(folder) => dispatch({ type: "folderEdited", folder })}
          />
          <div className={styles.hint}>{t("dialog.createDisk.folder.hint")}</div>
        </div>
      </DialogRow>
      <DialogRow label={t("dialog.createDisk.filename.label")}>
        <TextInput
          value={vm.filename.value}
          error={vm.filename.error}
          onChange={(filename) => dispatch({ type: "filenameEdited", filename })}
        />
      </DialogRow>
    </DialogForm>
  );
};
