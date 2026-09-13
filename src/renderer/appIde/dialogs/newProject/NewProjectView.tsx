import { TextInput } from "@controls/TextInput";
import { DialogForm } from "@renderer/controls/DialogForm";
import { DialogRow } from "@renderer/controls/DialogRow";
import Dropdown from "@renderer/controls/Dropdown";

import type { NewProjectIntent } from "./NewProjectIntents";
import type { NewProjectViewModel } from "./NewProjectViewModel";
import styles from "./NewProjectDialog.module.scss";

export type NewProjectViewProps = {
  vm: NewProjectViewModel;
  dispatch: (intent: NewProjectIntent) => void;
};

/**
 * The New Project dialog body. It renders the view model and reports what the
 * user did; every decision behind those fields belongs to the model.
 */
export const NewProjectView = ({ vm, dispatch }: NewProjectViewProps) => (
  <DialogForm
    submitLabel={vm.submitLabel}
    submitDisabled={!vm.submitEnabled}
    submitting={vm.submitting}
    onSubmit={() => dispatch({ type: "createRequested" })}
    onCancel={() => dispatch({ type: "cancelRequested" })}
  >
    <DialogRow label="Machine type: *">
      <div className={styles.dropdownWrapper}>
        <Dropdown
          placeholder="Select..."
          options={vm.machine.options}
          initialValue={vm.machine.value}
          width={468}
          onChanged={(value) => dispatch({ type: "machineSelected", value })}
        />
      </div>
    </DialogRow>
    <DialogRow label="Project Template: *">
      <div className={styles.dropdownWrapper} data-testid="new-project-templates">
        <Dropdown
          placeholder="Select..."
          options={vm.template.options}
          initialValue={vm.template.value}
          width={468}
          onChanged={(templateId) => dispatch({ type: "templateSelected", templateId })}
        />
      </div>
    </DialogRow>
    <DialogRow label="Project folder:">
      <TextInput
        value={vm.projectFolder.value}
        error={vm.projectFolder.error}
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
        onChange={(folder) => dispatch({ type: "projectFolderEdited", folder })}
      />
    </DialogRow>
    <DialogRow label="Project name:">
      <TextInput
        value={vm.projectName.value}
        error={vm.projectName.error}
        onChange={(name) => dispatch({ type: "projectNameEdited", name })}
      />
    </DialogRow>
  </DialogForm>
);
