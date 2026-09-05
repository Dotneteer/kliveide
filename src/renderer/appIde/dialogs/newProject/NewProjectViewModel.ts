import {
  MACHINE_OPTIONS,
  folderErrorOf,
  isComplete,
  machineValueOf,
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
  machine: {
    options: MachineOption[];
    value: string;
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
    machine: {
      options: MACHINE_OPTIONS,
      value: machineValueOf(state)
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
