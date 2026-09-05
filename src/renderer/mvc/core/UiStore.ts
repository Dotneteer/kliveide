import type { UiListener, UiReducer, Unsubscribe } from "./types";

/**
 * A minimal observable state container: the Model half of the UI MVC split.
 *
 * It knows nothing about React, promises or the DOM, which is what lets the
 * layers built on it run in the fast `node` test project.
 */
export class UiStore<TState, TEvent> {
  private state: TState;
  private readonly listeners = new Set<UiListener>();
  private readonly log: TEvent[] = [];

  constructor(
    initialState: TState,
    private readonly reduce: UiReducer<TState, TEvent>
  ) {
    this.state = initialState;
  }

  getSnapshot = (): TState => this.state;

  subscribe = (listener: UiListener): Unsubscribe => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dispatch = (event: TEvent): TState => {
    const next = this.reduce(this.state, event);
    this.log.push(event);
    // --- Reference equality is the signal. A reducer that returns the same
    // --- object notifies nobody, which is what keeps useSyncExternalStore quiet.
    if (next !== this.state) {
      this.state = next;
      // --- Snapshot the set first: a listener is allowed to unsubscribe itself
      // --- (or another) while being notified.
      for (const listener of [...this.listeners]) {
        listener();
      }
    }
    return next;
  };

  // --- Every event ever dispatched, in order, including ones that changed
  // --- nothing. A testing affordance: it lets a test assert what happened, not
  // --- only where the state ended up. Production code must not read it.
  get events(): readonly TEvent[] {
    return this.log;
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}
