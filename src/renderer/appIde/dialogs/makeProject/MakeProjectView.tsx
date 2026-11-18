import { useT } from "@common/i18n/useT";
import { Checkbox } from "@renderer/controls/Checkbox";
import { DialogForm } from "@renderer/controls/DialogForm";
import { DialogRow } from "@renderer/controls/DialogRow";
import Dropdown from "@renderer/controls/Dropdown";
import { RadioGroup } from "@renderer/controls/RadioGroup";

import type { MakeProjectIntent } from "./MakeProjectIntents";
import type { MakeProjectChoice } from "./MakeProjectModel";
import type { MakeProjectViewModel } from "./MakeProjectViewModel";
import styles from "./MakeProjectDialog.module.scss";
import ScrollViewer from "@renderer/controls/ScrollViewer";

export type MakeProjectViewProps = {
  vm: MakeProjectViewModel;
  dispatch: (intent: MakeProjectIntent) => void;
};

const FIELD_WIDTH = 468;

/**
 * The Make Klive Project dialog body. It renders the view model and reports what the user did;
 * every decision behind the fields belongs to the model.
 */
export const MakeProjectView = ({ vm, dispatch }: MakeProjectViewProps) => {
  const t = useT();
  return (
    <DialogForm
      submitLabel={vm.submitLabel}
      submitDisabled={!vm.submitEnabled}
      submitting={vm.submitting}
      onSubmit={() => dispatch({ type: "submitRequested" })}
      onCancel={() => dispatch({ type: "cancelRequested" })}
    >
      <p className={styles.lead} data-testid="make-project-lead">
        {vm.lead}
      </p>
      <DialogRow>
        <RadioGroup
          ariaLabel={t("dialog.makeProject.choice.ariaLabel")}
          enabled={vm.choice.enabled}
          value={vm.choice.value}
          options={vm.choice.options}
          onChange={(choice) => dispatch({ type: "choiceSelected", choice: choice as MakeProjectChoice })}
        />
      </DialogRow>
      <DialogRow label={t("dialog.makeProject.field.machineType")}>
        <div className={styles.dropdownWrapper} data-testid="make-project-machine-types">
          <Dropdown
            placeholder={t("dialog.newProject.selectPlaceholder")}
            ariaLabel={t("dialog.newProject.field.machineTypeAria")}
            options={vm.machineType.options}
            initialValue={vm.machineType.value}
            enabled={vm.fieldsEnabled}
            width={FIELD_WIDTH}
            onChanged={(machineId) => dispatch({ type: "machineTypeSelected", machineId })}
          />
        </div>
      </DialogRow>
      <DialogRow label={t("dialog.makeProject.field.model")}>
        <div className={styles.dropdownWrapper} data-testid="make-project-models">
          <Dropdown
            placeholder={t("dialog.newProject.selectPlaceholder")}
            ariaLabel={t("dialog.newProject.field.modelAria")}
            options={vm.model.options}
            initialValue={vm.model.value}
            enabled={vm.model.enabled}
            width={FIELD_WIDTH}
            onChanged={(modelId) => dispatch({ type: "modelSelected", modelId })}
          />
        </div>
      </DialogRow>
      <DialogRow label={t("dialog.makeProject.field.template")}>
        <div className={styles.dropdownWrapper} data-testid="make-project-templates">
          <Dropdown
            placeholder={t("dialog.newProject.selectPlaceholder")}
            ariaLabel={t("dialog.makeProject.field.templateAria")}
            options={vm.template.options}
            initialValue={vm.template.value}
            enabled={vm.fieldsEnabled && !vm.template.loading}
            width={FIELD_WIDTH}
            onChanged={(templateId) => dispatch({ type: "templateSelected", templateId })}
          />
        </div>
      </DialogRow>
      <DialogRow label={t("dialog.makeProject.field.buildRoot")}>
        <div className={styles.dropdownWrapper} data-testid="make-project-build-roots">
          <Dropdown
            ariaLabel={t("dialog.makeProject.field.buildRootAria")}
            options={vm.buildRoot.options}
            initialValue={vm.buildRoot.value}
            enabled={vm.fieldsEnabled && !vm.buildRoot.loading}
            width={FIELD_WIDTH}
            onChanged={(buildRoot) => dispatch({ type: "buildRootSelected", buildRoot })}
          />
        </div>
      </DialogRow>
      {vm.conflicts.visible && (
        <div className={styles.conflicts} data-testid="make-project-conflicts">
          <div className={styles.conflictsNote}>{t("dialog.makeProject.conflicts.note")}</div>
          <ScrollViewer sizeToContent={true} allowHorizontal={false} className={styles.conflictList}>
            <div className={styles.conflictItems}>
              {vm.conflicts.items.map((item) =>
                item.canOverwrite ? (
                  <Checkbox
                    key={item.path}
                    label={item.path}
                    initialValue={item.overwrite}
                    enabled={vm.fieldsEnabled}
                    onChange={(overwrite) =>
                      dispatch({ type: "overwriteToggled", path: item.path, overwrite })
                    }
                  />
                ) : (
                  <div key={item.path} className={styles.blocked}>
                    {t("dialog.makeProject.conflicts.blocked", { path: item.path })}
                  </div>
                )
              )}
            </div>
          </ScrollViewer>
        </div>
      )}
    </DialogForm>
  );
};
