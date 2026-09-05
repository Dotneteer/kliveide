import { DialogForm } from "@renderer/controls/DialogForm";
import { DialogRow } from "@renderer/controls/DialogRow";
import Dropdown from "@renderer/controls/Dropdown";
import { TextInput } from "@renderer/controls/TextInput";

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
export const CreateDiskView = ({ vm, dispatch }: CreateDiskViewProps) => (
  <DialogForm
    submitLabel={vm.submitLabel}
    submitDisabled={!vm.submitEnabled}
    submitting={vm.submitting}
    onSubmit={() => dispatch({ type: "createRequested" })}
    onCancel={() => dispatch({ type: "cancelRequested" })}
  >
    <DialogRow rows={true} label="Disk type">
      <div className={styles.dropdownWrapper}>
        <Dropdown
          placeholder="Select..."
          options={vm.diskType.options}
          initialValue={vm.diskType.value}
          width={200}
          onChanged={(diskType) => dispatch({ type: "diskTypeSelected", diskType })}
        />
      </div>
    </DialogRow>
    <DialogRow label="Disk file folder:">
      <TextInput
        value={vm.folder.value}
        error={vm.folder.error}
        autoFocus={true}
        buttonIcon="folder"
        buttonTitle="Select the root project folder"
        // --- The controller owns the picker, so browse reports the click and
        // --- resolves empty; the chosen folder arrives back through the view
        // --- model rather than through TextInput's own onChange.
        browse={async () => {
          dispatch({ type: "selectFolderRequested" });
          return undefined;
        }}
        onChange={(folder) => dispatch({ type: "folderEdited", folder })}
      />
    </DialogRow>
    <DialogRow label="Project name:">
      <TextInput
        value={vm.filename.value}
        error={vm.filename.error}
        onChange={(filename) => dispatch({ type: "filenameEdited", filename })}
      />
    </DialogRow>
  </DialogForm>
);
