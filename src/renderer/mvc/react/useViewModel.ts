import { useSyncExternalStore } from "react";
import type { UiListener, Unsubscribe } from "../core/types";

// --- The narrow shape a view needs; a full UiController satisfies it, and so
// --- does a hand-written stub in a test.
export type ViewModelSource<TViewModel> = {
  subscribe: (listener: UiListener) => Unsubscribe;
  getSnapshot: () => TViewModel;
};

/**
 * Subscribes a component to a controller's view model.
 *
 * `getSnapshot` must return a reference-stable value while state is unchanged;
 * `UiController` guarantees that by memoizing its selector on state identity.
 */
export function useViewModel<TViewModel>(source: ViewModelSource<TViewModel>): TViewModel {
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
