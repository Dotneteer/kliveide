import { useT } from "@common/i18n/useT";
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
export const NewProjectView = ({ vm, dispatch }: NewProjectViewProps) => {
  const t = useT();
  return (
    <DialogForm
      submitLabel={vm.submitLabel}
      submitDisabled={!vm.submitEnabled}
      submitting={vm.submitting}
      onSubmit={() => dispatch({ type: "createRequested" })}
      onCancel={() => dispatch({ type: "cancelRequested" })}
    >
      <DialogRow label={t("dialog.newProject.field.machineType")}>
        <div className={styles.dropdownWrapper} data-testid="new-project-machine-types">
          <Dropdown
            placeholder={t("dialog.newProject.selectPlaceholder")}
            ariaLabel={t("dialog.newProject.field.machineTypeAria")}
            options={vm.machineType.options}
            initialValue={vm.machineType.value}
            width={468}
            onChanged={(machineId) => dispatch({ type: "machineTypeSelected", machineId })}
          />
        </div>
      </DialogRow>
      <DialogRow label={t("dialog.newProject.field.model")}>
        <div className={styles.dropdownWrapper} data-testid="new-project-models">
          <Dropdown
            placeholder={t("dialog.newProject.selectPlaceholder")}
            ariaLabel={t("dialog.newProject.field.modelAria")}
            options={vm.model.options}
            initialValue={vm.model.value}
            enabled={vm.model.enabled}
            width={468}
            onChanged={(modelId) => dispatch({ type: "modelSelected", modelId })}
          />
        </div>
      </DialogRow>
      <DialogRow label={t("dialog.newProject.field.template")}>
        <div className={styles.dropdownWrapper} data-testid="new-project-templates">
          <Dropdown
            placeholder={t("dialog.newProject.selectPlaceholder")}
            options={vm.template.options}
            initialValue={vm.template.value}
            width={468}
            onChanged={(templateId) => dispatch({ type: "templateSelected", templateId })}
          />
        </div>
      </DialogRow>
      <DialogRow label={t("dialog.newProject.field.folder")}>
        <TextInput
          value={vm.projectFolder.value}
          error={vm.projectFolder.error}
          autoFocus={true}
          buttonIcon="folder"
          buttonTitle={t("dialog.newProject.field.folderBrowse")}
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
      <DialogRow label={t("dialog.newProject.field.name")}>
        <TextInput
          value={vm.projectName.value}
          error={vm.projectName.error}
          onChange={(name) => dispatch({ type: "projectNameEdited", name })}
        />
      </DialogRow>
    </DialogForm>
  );
};
