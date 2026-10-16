import {
  folderErrorOf,
  isComplete,
  machineTypeOptionsOf,
  modelOptionsOf,
  projectNameErrorOf,
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

// ─── Selector ────────────────────────────────────────────────────────────────

export function selectViewModel(state: NewProjectState): NewProjectViewModel {
  return {
    machineType: {
      options: machineTypeOptionsOf(state),
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
    submitLabel: "Create",
    submitEnabled: isComplete(state) && !state.busy,
    submitting: state.busy
  };
}
