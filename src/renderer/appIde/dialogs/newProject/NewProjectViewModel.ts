import { t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";

import {
  folderErrorOf,
  isComplete,
  machineTypeOptionsOf,
  modelOptionsOf,
  projectNameErrorOf,
  type MachineFamilyId,
  type MachineOption,
  type NewProjectState
} from "./NewProjectModel";

// ─── View model shape ────────────────────────────────────────────────────────

export type TextFieldViewModel = {
  value: string;
  error?: string;
};

export type NewProjectViewModel = {
  machineType: {
    // --- Grouped by family (`MachineOption.group`).
    options: MachineOption[];
    value: string;
  };
  model: {
    options: MachineOption[];
    value: string;
    // --- Disabled, not hidden, for a type with one model: the form never moves.
    enabled: boolean;
  };
  template: {
    options: MachineOption[];
    value: string;
    // --- The list is being fetched for a machine that was just picked.
    loading: boolean;
  };
  projectFolder: TextFieldViewModel;
  projectName: TextFieldViewModel;
  submitLabel: string;
  submitEnabled: boolean;
  submitting: boolean;
};

// ─── Formatting ──────────────────────────────────────────────────────────────

const FAMILY_LABEL_KEYS: Readonly<Record<MachineFamilyId, MessageKey>> = {
  zxSpectrum: "dialog.newProject.family.zxSpectrum",
  spectrumCompatibles: "dialog.newProject.family.spectrumCompatibles",
  otherZ80: "dialog.newProject.family.otherZ80",
  other: "dialog.newProject.family.other"
};

/** The label of a machine family, the group heading of the type list */
export function familyLabelOf(family: MachineFamilyId): string {
  return t(FAMILY_LABEL_KEYS[family]);
}

// ─── Selector ────────────────────────────────────────────────────────────────

export function selectViewModel(state: NewProjectState): NewProjectViewModel {
  return {
    machineType: {
      options: machineTypeOptionsOf(state).map((option) => ({
        ...option,
        group: familyLabelOf(option.group)
      })),
      value: state.machineId
    },
    model: {
      options: modelOptionsOf(state),
      value: state.modelId ?? "",
      enabled: modelOptionsOf(state).length > 1
    },
    template: {
      // --- A template directory is its own label; there is nothing to pretty up.
      options: state.templates.map((name) => ({ value: name, label: name })),
      value: state.templateId,
      loading: state.templatesLoading
    },
    projectFolder: {
      value: state.projectFolder,
      error: folderErrorOf(state)
    },
    projectName: {
      value: state.projectName,
      error: projectNameErrorOf(state)
    },
    submitLabel: t("dialog.newProject.submit"),
    submitEnabled: isComplete(state) && !state.busy,
    submitting: state.busy
  };
}
