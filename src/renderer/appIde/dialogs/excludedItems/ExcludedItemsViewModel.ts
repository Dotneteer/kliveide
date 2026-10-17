import { t } from "@common/i18n/i18n";

import { excludedIdsOf, UNNAMED_PROJECT, type ExcludedItemsState } from "./ExcludedItemsModel";

// ─── View model shape ────────────────────────────────────────────────────────

export type ExcludedItemViewModel = {
  id: string;
  // --- The path in the platform's own separators, which is what the user typed.
  value: string;
  // --- Only the project's own items can be taken off the list here; the global
  // --- ones are managed elsewhere and are shown for context.
  removable: boolean;
};

export type ExcludedItemsViewModel = {
  projectList: {
    label: string;
    items: ExcludedItemViewModel[];
  };
  globalList: {
    label: string;
    items: ExcludedItemViewModel[];
    loading: boolean;
  };
  applyEnabled: boolean;
};

// ─── Selector ────────────────────────────────────────────────────────────────

// --- The project list's heading. Text lives here rather than in the model, which stays text-free.
export function projectListLabelOf(state: ExcludedItemsState): string {
  const name = state.env.projectName;
  return t("dialog.excludedItems.projectList", {
    project: name === UNNAMED_PROJECT ? t("dialog.excludedItems.unnamedProject") : name
  });
}

export function selectViewModel(state: ExcludedItemsState): ExcludedItemsViewModel {
  return {
    projectList: {
      label: projectListLabelOf(state),
      items: state.projectItems.map((item) => ({ ...item, removable: true }))
    },
    globalList: {
      label: t("dialog.excludedItems.globalList"),
      items: state.globalItems.map((item) => ({ ...item, removable: false })),
      loading: state.globalsLoading
    },
    applyEnabled: !state.busy
  };
}

// --- Exposed for the container's result; the view never needs it.
export { excludedIdsOf };
