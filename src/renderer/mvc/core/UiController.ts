import { UiStore } from "./UiStore";
import type { UiReducer, UiSelector, UiListener, Unsubscribe } from "./types";

/**
 * The Controller half of the UI MVC split: it turns user *intents* into port
 * calls, and port results into *events* the pure reducer applies.
 *
 * Two vocabularies is deliberate. Intents are what a user can do
 * (`testAgainRequested`); events are what can change state
 * (`validationSettled`). Keeping them apart is what leaves `reduce` pure and
 * lets a test drive a whole dialog with no React and no DOM.
 *
 * Subclasses implement `handle` and are the only code that touches ports.
 */
export abstract class UiController<TState, TIntent, TEvent, TViewModel> {
  protected readonly store: UiStore<TState, TEvent>;
  private readonly pending = new Set<Promise<void>>();
  private readonly select: UiSelector<TState, TViewModel>;
  private viewModelState?: TState;
  private viewModelCache?: TViewModel;
  private disposed = false;

  constructor(
    initialState: TState,
    reduce: UiReducer<TState, TEvent>,
    select: UiSelector<TState, TViewModel>
  ) {
    this.store = new UiStore(initialState, reduce);
    this.select = select;
  }

  get state(): TState {
    return this.store.getSnapshot();
  }

  /**
   * Memoized on state identity. `useSyncExternalStore` compares snapshots by
   * reference and re-renders whenever they differ, so recomputing the view
   * model on every read would loop forever.
   */
  get viewModel(): TViewModel {
    const state = this.state;
    if (this.viewModelState !== state || this.viewModelCache === undefined) {
      this.viewModelState = state;
      this.viewModelCache = this.select(state);
    }
    return this.viewModelCache;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  // --- The event log of the underlying store. A testing affordance.
  get events(): readonly TEvent[] {
    return this.store.events;
  }

  subscribe = (listener: UiListener): Unsubscribe => this.store.subscribe(listener);

  getSnapshot = (): TViewModel => this.viewModel;

  /**
   * Runs one user intent. The returned promise resolves when this intent's own
   * work is finished; use `settle()` when follow-up work may have been started.
   */
  dispatch(intent: TIntent): Promise<void> {
    // --- A view can dispatch from a handler that outlives the component; after
    // --- dispose there is nothing left to update.
    if (this.disposed) return Promise.resolve();

    let work: Promise<void>;
    try {
      work = Promise.resolve(this.handle(intent));
    } catch (error) {
      // --- A handler that throws synchronously is the same failure as one that
      // --- rejects, and must not escape into the view's event handler.
      this.onUnhandled(error, intent);
      return Promise.resolve();
    }

    const tracked = work.catch((error) => {
      this.onUnhandled(error, intent);
    });
    this.pending.add(tracked);
    void tracked.finally(() => {
      this.pending.delete(tracked);
    });
    return tracked;
  }

  /**
   * Drains every in-flight handler, transitively: an intent whose handler starts
   * follow-up work is fully awaited, so tests never sprinkle
   * `await Promise.resolve()` to chase microtasks.
   */
  async settle(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all([...this.pending]);
    }
  }

  // --- Applies an event to the model. The only way state ever changes.
  protected emit(event: TEvent): void {
    if (this.disposed) return;
    this.store.dispatch(event);
  }

  protected abstract handle(intent: TIntent): void | Promise<void>;

  // --- Last resort for a handler that failed in a way it did not model. A
  // --- controller that can show the error to the user should override this and
  // --- emit an event instead.
  protected onUnhandled(error: unknown, intent: TIntent): void {
    console.error("Unhandled error while handling intent", intent, error);
  }

  /**
   * Re-enables a controller that was disposed.
   *
   * `dispose` / `activate` are a symmetric pair because React's effect contract
   * is setup → cleanup → setup: under `StrictMode` every effect is torn down and
   * re-run once in development. A controller that could only be disposed would
   * be permanently dead after that cycle, with its view frozen on whatever it
   * was doing at the time.
   */
  activate(): void {
    this.disposed = false;
  }

  // --- Subclasses that own LatestRun instances should cancel them here, then
  // --- call `super.dispose()`. Work started before disposal is dropped: its
  // --- events never reach the store.
  dispose(): void {
    this.disposed = true;
  }
}
