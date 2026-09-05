import type { UiController } from "@mvc/core/UiController";

/**
 * Drives any UiController from a test.
 *
 * The distinction that matters is `dispatch` vs `send`: `dispatch` runs an
 * intent to completion, while `send` deliberately leaves it in flight so the
 * busy view model — the one a user actually looks at while work runs — can be
 * asserted.
 */
export type ControllerHarness<TState, TIntent, TEvent, TViewModel> = {
  readonly controller: UiController<TState, TIntent, TEvent, TViewModel>;
  readonly state: TState;
  readonly vm: TViewModel;
  readonly events: readonly TEvent[];
  // --- Event `type` fields in order, for asserting what happened rather than
  // --- only where the state landed.
  readonly eventTypes: string[];
  dispatch(intent: TIntent): Promise<void>;
  send(intent: TIntent): Promise<void>;
  settle(): Promise<void>;
  dispose(): void;
};

/**
 * Wraps a controller for a test.
 *
 * `extras` exists so callers never spread the result: `state`, `vm` and
 * `events` are getters, and `{ ...harnessFor(c), ports }` would evaluate them
 * once and freeze the snapshot at construction time. Pass the extra fields in
 * here instead and they are merged before the getters are defined.
 */
export function harnessFor<TState, TIntent, TEvent, TViewModel, TExtra extends object = {}>(
  controller: UiController<TState, TIntent, TEvent, TViewModel>,
  extras?: TExtra
): ControllerHarness<TState, TIntent, TEvent, TViewModel> & TExtra {
  return {
    ...((extras ?? {}) as TExtra),
    controller,
    get state() {
      return controller.state;
    },
    get vm() {
      return controller.viewModel;
    },
    get events() {
      return controller.events;
    },
    get eventTypes() {
      return controller.events.map((event) => (event as { type: string }).type);
    },
    // --- Runs the intent and everything it started, so a test reads as one step
    async dispatch(intent) {
      await controller.dispatch(intent);
      await controller.settle();
    },
    // --- Starts the intent and returns immediately; pair it with settle()
    send(intent) {
      return controller.dispatch(intent);
    },
    settle: () => controller.settle(),
    dispose: () => controller.dispose()
  };
}
