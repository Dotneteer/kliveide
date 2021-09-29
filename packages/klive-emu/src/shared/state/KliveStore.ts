import { AnyAction, Observable, Reducer, Store, Unsubscribe } from "redux";
import { getService, STORE_SERVICE } from "@abstractions/service-registry";
import { ILiteEvent, LiteEvent } from "../utils/LiteEvent";
import {
  ActivityBarState,
  AppState,
  EmulatorPanelState,
  EmuViewOptions,
  ProjectState,
  ToolFrameState,
} from "./AppState";
import { KliveAction } from "./state-core";
import { Activity } from "@abstractions/activity";

/**
 * Represents a store instance that handles Klive application state
 */
export class KliveStore {
  // --- Stores the previous state
  private _prevState: AppState | null = null;
  private _unsubscribe: Unsubscribe;

  // --- Event emitters
  private _stateChanged = new LiteEvent<AppState>();
  private _themeChanged = new LiteEvent<string>();
  private _isWindowsChanged = new LiteEvent<boolean>();
  private _emuViewOptionsChanged = new LiteEvent<EmuViewOptions>();
  private _toolFrameChanged = new LiteEvent<ToolFrameState>();
  private _currentActivityChanged = new LiteEvent<Activity>();
  private _activityBarChanged = new LiteEvent<ActivityBarState>();
  private _emulatorPanelChanged = new LiteEvent<EmulatorPanelState>();
  private _executionStateChanged = new LiteEvent<number>();
  private _machineTypeChanged = new LiteEvent<string>();
  private _projectChanged = new LiteEvent<ProjectState>();
  private _vmPropertyChanged = new LiteEvent<EmulatorPanelState>();

  /**
   * Initializes this instance with the specified redux store
   * @param store
   */
  constructor(public readonly store: Store) {
    this._prevState = store.getState();
    this._unsubscribe = store.subscribe(() => this.processStateChanges());
  }

  /**
   * Dispose store subscriptions
   */
  dispose(): void {
    this._unsubscribe?.();
  }

  /**
   * Dispatches the specified action
   * @param action Action to dispatch
   */
  dispatch(action: KliveAction): KliveAction {
    return this.store.dispatch(action);
  }

  /**
   * Gets the current state of the store
   */
  getState(): AppState {
    return this.store.getState() as AppState;
  }

  /**
   * Subscribes to the specified listener
   * @param listener Listener function
   * @returns Unsubscribe function
   */
  subscribe(listener: () => void): Unsubscribe {
    return this.store.subscribe(listener);
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param nextReducer The reducer for the store to use instead.
   */
  replaceReducer(nextReducer: Reducer<any, AnyAction>): void {
    this.store.replaceReducer(nextReducer);
  }

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/tc39/proposal-observable
   */
  [Symbol.observable](): Observable<any> {
    return this.store[Symbol.observable]();
  }

  /**
   * Fires when the application state changes
   */
  get stateChanged(): ILiteEvent<AppState> {
    return this._stateChanged;
  }

  /**
   * Fires when the `isWindows` state property changes
   */
  get isWindowsChanged(): ILiteEvent<boolean> {
    return this._isWindowsChanged;
  }

  /**
   * Fires when the `theme` state property changes
   */
  get themeChanged(): ILiteEvent<string> {
    return this._themeChanged;
  }

  /**
   * Fires when the `emuViewOptions` state property changes
   */
  get emuViewOptionsChanged(): ILiteEvent<EmuViewOptions> {
    return this._emuViewOptionsChanged;
  }

  /**
   * Fires when the `toolFrame` state property changes
   */
  get toolFrameChanged(): ILiteEvent<ToolFrameState> {
    return this._toolFrameChanged;
  }

  /**
   * Fires when the `activityBar` state property changes
   */
  get activityBarChanged(): ILiteEvent<ActivityBarState> {
    return this._activityBarChanged;
  }

  /**
   * Fires when the `activityBar` state property changes
   */
   get currentActivityChanged(): ILiteEvent<Activity> {
    return this._currentActivityChanged;
  }

  /**
   * Fires when the `emulatorPanel` state property changes
   */
  get emulatorPanelChanged(): ILiteEvent<EmulatorPanelState> {
    return this._emulatorPanelChanged;
  }

  /**
   * Fires when the `emulatorPanel.executionState` state property changes
   */
  get executionStateChanged(): ILiteEvent<number> {
    return this._executionStateChanged;
  }

  /**
   * Fires when the `machineType` state property changes
   */
  get machineTypeChanged(): ILiteEvent<string> {
    return this._machineTypeChanged;
  }

  /**
   * Fires when the `projectState` state property changes
   */
  get projectChanged(): ILiteEvent<ProjectState> {
    return this._projectChanged;
  }

  /**
   * Process state changes
   */
  private processStateChanges() {
    const state = this.store.getState() as AppState;
    this._stateChanged.fire(state);
    const oldState = this._prevState;
    this._prevState = state;
    if (!oldState) {
      return;
    }

    // --- theme
    if (state.theme !== oldState.theme) {
      this._themeChanged.fire(state.theme);
    }

    // --- isWindows
    if (state.isWindows !== oldState.isWindows) {
      this._isWindowsChanged.fire(state.isWindows);
    }

    // --- emuViewOptions
    if (state.emuViewOptions !== oldState.emuViewOptions) {
      this._emuViewOptionsChanged.fire(state.emuViewOptions);
    }

    // --- toolFrame
    if (state.toolFrame !== oldState.toolFrame) {
      this._toolFrameChanged.fire(state.toolFrame);
    }

    // --- activityBar
    if (
      state.activityBar !== oldState.activityBar &&
      state.activityBar?.activeIndex != oldState.activityBar?.activeIndex
    ) {
      const currentActivity =
        !state.activityBar || typeof state.activityBar.activeIndex !== "number"
          ? null
          : state.activityBar.activities[state.activityBar.activeIndex];
      this._currentActivityChanged.fire(currentActivity);
    }

    // --- machineType
    if (state.machineType !== oldState.machineType) {
      this._machineTypeChanged.fire(state.machineType);
    }

    // --- emulatorPanel
    if (state.emulatorPanel !== oldState.emulatorPanel) {
      this._emulatorPanelChanged.fire(state.emulatorPanel);

      // --- executionState
      if (
        state.emulatorPanel?.executionState !==
        oldState.emulatorPanel?.executionState
      ) {
        this._executionStateChanged.fire(state.emulatorPanel.executionState);
      }
    }

    // --- project
    if (state.project !== oldState.project) {
      this._projectChanged.fire(state.project);
    }
  }
}
