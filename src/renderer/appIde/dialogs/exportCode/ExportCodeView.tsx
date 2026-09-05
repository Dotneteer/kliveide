import { TextInput } from "@controls/TextInput";
import { Checkbox } from "@renderer/controls/Checkbox";
import { DialogForm } from "@renderer/controls/DialogForm";
import { DialogRow } from "@renderer/controls/DialogRow";
import Dropdown from "@renderer/controls/Dropdown";

import type { ExportCodeIntent } from "./ExportCodeIntents";
import type { ExportCodeSettings } from "./ExportCodeModel";
import type { ExportCodeViewModel } from "./ExportCodeViewModel";
import styles from "./ExportCodeDialog.module.scss";

export type ExportCodeViewProps = {
  vm: ExportCodeViewModel;
  dispatch: (intent: ExportCodeIntent) => void;
};

/**
 * The Export Code dialog body. Which sections appear is a view-model field, not
 * a conditional about the format: the rule that HEX has no loader lives in the
 * model, where it can be tested without rendering anything.
 */
export const ExportCodeView = ({ vm, dispatch }: ExportCodeViewProps) => {
  // --- Every form control reports the same way; only the field differs.
  const edit = (patch: Partial<ExportCodeSettings>) =>
    dispatch({ type: "settingEdited", patch });

  return (
    <DialogForm
      submitLabel={vm.submitLabel}
      submitDisabled={!vm.submitEnabled}
      submitting={vm.submitting}
      onSubmit={() => dispatch({ type: "exportRequested" })}
      onCancel={() => dispatch({ type: "cancelRequested" })}
    >
      <DialogRow label="Export format:">
        <div className={styles.dropdownWrapper} data-testid="export-format">
          <Dropdown
            placeholder="Select..."
            options={vm.format.options}
            initialValue={vm.format.value}
            width={140}
            onChanged={(formatId) => edit({ formatId })}
          />
        </div>
      </DialogRow>
      <DialogRow label="Export folder:">
        <TextInput
          value={vm.exportFolder.value}
          error={vm.exportFolder.error}
          buttonIcon="folder"
          buttonTitle="Select the root project folder"
          // --- The controller owns the picker, so browse reports the click and
          // --- resolves empty; the chosen folder arrives back through the view
          // --- model rather than through TextInput's own onChange.
          browse={async () => {
            dispatch({ type: "selectExportFolderRequested" });
            return undefined;
          }}
          onChange={(exportFolder) => edit({ exportFolder })}
        />
      </DialogRow>
      <DialogRow label="Export file name: *">
        <TextInput
          value={vm.exportName.value}
          error={vm.exportName.error}
          autoFocus={true}
          onChange={(exportName) => edit({ exportName })}
        />
      </DialogRow>
      <DialogRow label="Program name:">
        <TextInput
          value={vm.programName.value}
          width={100}
          maxLength={10}
          onChange={(programName) => edit({ programName })}
        />
      </DialogRow>

      {vm.loader.kind === "shown" && (
        <DialogRow rows={true}>
          <Checkbox
            initialValue={vm.loader.checked}
            right={true}
            label="Create BASIC loader"
            onChange={(startBlock) => edit({ startBlock })}
          />
        </DialogRow>
      )}

      {vm.startup.kind === "shown" && (
        <>
          <DialogRow label="Startup options:" />
          <DialogRow rows={true}>
            <Checkbox
              initialValue={vm.startup.addClear}
              right={true}
              label="Add CLEAR"
              onChange={(addClear) => edit({ addClear })}
            />
            <Checkbox
              initialValue={vm.startup.addPause}
              right={true}
              label="Add PAUSE 0"
              onChange={(addPause) => edit({ addPause })}
            />
            <Checkbox
              initialValue={vm.startup.singleBlock}
              right={true}
              label="Use a single code block"
              onChange={(singleBlock) => edit({ singleBlock })}
            />
          </DialogRow>
          <DialogRow label="Set border color:">
            <div className={styles.dropdownWrapper} data-testid="export-border">
              <Dropdown
                placeholder="Select..."
                options={vm.startup.border.options}
                initialValue={vm.startup.border.value}
                width={92}
                onChanged={(borderId) => edit({ borderId })}
              />
            </div>
          </DialogRow>
          <DialogRow label="Screen file:">
            <TextInput
              value={vm.startup.screenFile.value}
              error={vm.startup.screenFile.error}
              buttonIcon="file-code"
              buttonTitle="Select the screen file"
              browse={async () => {
                dispatch({ type: "selectScreenFileRequested" });
                return undefined;
              }}
              onChange={(screenFilename) => edit({ screenFilename })}
            />
          </DialogRow>
          <DialogRow label="Code start address:">
            <TextInput
              value={vm.startup.startAddress.value}
              maxLength={5}
              width={60}
              numberOnly
              error={vm.startup.startAddress.error}
              onChange={(startAddress) => edit({ startAddress })}
            />
          </DialogRow>
        </>
      )}
    </DialogForm>
  );
};
