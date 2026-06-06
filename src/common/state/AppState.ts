/**
 * Represents the state of the entire application
 */
export type AppState = {
  appPath?: string;
  emuLoaded?: boolean;
  emuStateSynched?: boolean;
  ideLoaded?: boolean;
  ideStateSynched?: boolean;
  startScreenDisplayed?: boolean;
  isWindows?: boolean;
  emuFocused?: boolean;
  ideFocused?: boolean;
  dimMenu?: boolean;
  theme?: string;
  globalSettings?: Record<string, any>;
};

/**
 * The initial application state
 */
export const initialAppState: AppState = {
  emuLoaded: false,
  ideLoaded: false,
  isWindows: false,
  theme: "dark",
  emuFocused: false,
  ideFocused: false,
  globalSettings: {},
};
