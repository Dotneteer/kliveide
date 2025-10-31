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
  os?: string;
  emuFocused?: boolean;
  ideFocused?: boolean;
  globalSettings?: Record<string, any>;
};

/**
 * The initial application state
 */
export const initialAppState: AppState = {
  appPath: "",
  emuLoaded: false,
  ideLoaded: false,
  isWindows: false,
  os: "",
  emuFocused: false,
  ideFocused: false,
  globalSettings: {},
};
