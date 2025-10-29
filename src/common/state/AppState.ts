/**
 * Represents the state of the entire application
 */
export type AppState = {
  appPath?: string;
  emuLoaded?: boolean;
  emuStateSynched?: boolean;
  ideLoaded?: boolean;
  ideStateSynched?: boolean;
  isWindows?: boolean;
  emuFocused?: boolean;
  ideFocused?: boolean;
};

/**
 * The initial application state
 */
export const initialAppState: AppState = {
  emuLoaded: false,
  ideLoaded: false,
  isWindows: false,
  emuFocused: false,
  ideFocused: false,
};
