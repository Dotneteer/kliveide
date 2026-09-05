/**
 * Core types of the UI MVC infrastructure.
 *
 * The names carry a `Ui` prefix because `@state/redux-light` already exports
 * `Store`, `Reducer`, `Dispatch` and `Unsubscribe`; a file can import from both
 * without aliasing.
 */

// --- A pure, total state transition. Returning the same object reference means
// --- "nothing changed" and notifies no subscriber.
export type UiReducer<TState, TEvent> = (state: TState, event: TEvent) => TState;

// --- Derives everything a view renders from state. Must be pure: it is called
// --- on every state change and its result is compared by reference.
export type UiSelector<TState, TViewModel> = (state: TState) => TViewModel;

export type UiListener = () => void;

export type Unsubscribe = () => void;

// --- What a view is handed to report user actions. Always fire-and-forget from
// --- the view's point of view; tests await the returned promise instead.
export type UiDispatch<TIntent> = (intent: TIntent) => void;
