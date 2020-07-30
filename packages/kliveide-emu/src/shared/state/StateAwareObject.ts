import { Unsubscribe } from "redux";
import { AppState } from "./AppState";
import { SpectNetAction } from "./redux-core";
import { LiteEvent, ILiteEvent } from "../utils/LiteEvent";
/**
 * Reprensent an object that is aware of the state of its associated store
 */
export class StateAwareObject<TState = AppState> {
  private _unsubscribeFunc: Unsubscribe;
  private _previousState: TState;
  private _state: TState;
  private _onStateChanged = new LiteEvent<TState>();

  constructor(
    public readonly store: any,
    public readonly substateName: keyof AppState | null = null
  ) {
    this._unsubscribeFunc = store.subscribe(() => {
      this.evalState();
    });
  }

  /**
   * Unsubscribes from store state changes
   */
  dispose(): void {
    this._unsubscribeFunc();
    this._onStateChanged.release();
  }

  /**
   * The current state of the store
   */
  get state(): TState {
    return this._state;
  }

  /**
   * Gets the previous state of the store
   */
  get previousState(): TState {
    return this._previousState;
  }

  /**
   * Dispatches and action
   * @param action The action to dispatch
   */
  dispatch(action: SpectNetAction): void {
    this.store.dispatch(action);
  }

  /**
   * Evaluates the current state, if necessary, triggers state
   * changed events.
   */
  evalState(): void {
    const state = this.store.getState() as AppState;
    this._previousState = this._state;
    this._state = this.extractPartialState(state);
    if (this._previousState !== this._state) {
      this._onStateChanged.fire(this._state);
    }
  }

  // ==========================================================================
  // Abstract and virtual methods to override

  /**
   * Extracts the partial state from the entire state object
   * @param state Full state object
   */
  extractPartialState(state: AppState): TState {
    return this.substateName
      ? ((state[this.substateName] as unknown) as TState)
      : ((state as unknown) as TState);
  }

  /**
   * This method is called whenever the state behind this component changes.
   * Override this method to respond to those changes.
   * @param oldState Old state
   * @param newState New state
   */
  get onStateChanged(): ILiteEvent<TState> {
    return this._onStateChanged;
  }
}
