import {
  excludedIdsOf,
  projectListLabelOf,
  type ExcludedItemsState
} from "./ExcludedItemsModel";

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

export function selectViewModel(state: ExcludedItemsState): ExcludedItemsViewModel {
  return {
    projectList: {
      label: projectListLabelOf(state),
      items: state.projectItems.map((item) => ({ ...item, removable: true }))
    },
    globalList: {
      label: "Global Excludes:",
      items: state.globalItems.map((item) => ({ ...item, removable: false })),
      loading: state.globalsLoading
    },
    applyEnabled: !state.busy
  };
}

// --- Exposed for the container's result; the view never needs it.
export { excludedIdsOf };
