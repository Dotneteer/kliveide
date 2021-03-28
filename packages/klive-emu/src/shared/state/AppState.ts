/**
 * Represents the application's entire state vector
 */
export interface AppState {
  emuUiLoaded: boolean;
  ideUiLoaded: boolean;
}

/**
 * The initial application state
 */
export function getInitialAppState(): AppState {
  return {
    emuUiLoaded: false,
    ideUiLoaded: false,
  };
}
