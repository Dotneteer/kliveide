import { t } from "@common/i18n/i18n";

import {
  machineTypeOptionsOf,
  modelOptionsOf,
  type MachineOption
} from "../newProject/NewProjectModel";
import { familyLabelOf } from "../newProject/NewProjectViewModel";
import {
  DEFAULT_BUILD_ROOT,
  NO_TEMPLATE,
  isReady,
  type MakeProjectChoice,
  type MakeProjectState
} from "./MakeProjectModel";

// ─── View model shape ────────────────────────────────────────────────────────

export type ConflictItemViewModel = {
  path: string;
  /** False: a folder is in the way; the file is shown, never written */
  canOverwrite: boolean;
  overwrite: boolean;
};

export type MakeProjectViewModel = {
  /** The sentence above the form: why the dialog appeared, naming the folder */
  lead: string;
  choice: {
    value: MakeProjectChoice;
    options: { value: MakeProjectChoice; label: string }[];
    enabled: boolean;
  };
  /** The project fields; disabled while "keep" is chosen or the dialog works */
  fieldsEnabled: boolean;
  machineType: { options: MachineOption[]; value: string };
  model: { options: MachineOption[]; value: string; enabled: boolean };
  template: { options: MachineOption[]; value: string; loading: boolean };
  buildRoot: { options: MachineOption[]; value: string; loading: boolean };
  conflicts: {
    /** Shown only for "make" with a template that lands on existing items */
    visible: boolean;
    items: ConflictItemViewModel[];
  };
  submitLabel: string;
  submitEnabled: boolean;
  submitting: boolean;
};

// ─── Selector ────────────────────────────────────────────────────────────────

export function selectViewModel(state: MakeProjectState): MakeProjectViewModel {
  const make = state.choice === "make";
  const fieldsEnabled = make && !state.busy;
  const modelOptions = modelOptionsOf(state);
  return {
    lead: state.offer
      ? t("dialog.makeProject.lead.offer", { folder: state.folder })
      : t("dialog.makeProject.lead.menu", { folder: state.folder }),
    choice: {
      value: state.choice,
      options: [
        { value: "make", label: t("dialog.makeProject.choice.make") },
        { value: "keep", label: t("dialog.makeProject.choice.keep") }
      ],
      enabled: !state.busy
    },
    fieldsEnabled,
    machineType: {
      // --- The machines that have templates, once known (Q7)
      options: machineTypeOptionsOf(state).map((option) => ({
        ...option,
        group: familyLabelOf(option.group)
      })),
      value: state.machineId
    },
    model: {
      options: modelOptions,
      value: state.modelId ?? "",
      enabled: fieldsEnabled && modelOptions.length > 1
    },
    template: {
      // --- A template directory is its own label, as in New Project. No "none" entry (Q7)
      options: state.templates.map((name) => ({ value: name, label: name })),
      value: state.templateId,
      loading: state.templatesLoading
    },
    buildRoot: {
      options: [
        { value: DEFAULT_BUILD_ROOT, label: t("dialog.makeProject.buildRoot.template") },
        ...(state.candidates ?? []).map((c) => ({ value: c, label: c }))
      ],
      value: state.buildRoot,
      loading: state.candidates === undefined
    },
    conflicts: {
      visible: make && state.templateId !== NO_TEMPLATE && state.conflicts.length > 0,
      items: state.conflicts.map((c) => ({
        path: c.path,
        canOverwrite: c.canOverwrite,
        overwrite: c.canOverwrite && state.overwrite.includes(c.path)
      }))
    },
    submitLabel: make ? t("dialog.makeProject.submit.make") : t("dialog.makeProject.submit.keep"),
    submitEnabled: isReady(state),
    submitting: state.busy
  };
}
