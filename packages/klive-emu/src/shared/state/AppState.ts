/**
 * Represents the application's entire state vector
 */
export interface AppState {
  emuUiLoaded: boolean;
  ideUiLoaded: boolean;
  theme: string;
  emuViewOptions: EmuViewOptions;
}

/**
 * Represents the options of the Emulators's View menu
 */
export interface EmuViewOptions {
  showToolbar?: boolean;
  showStatusBar?: boolean;
  showFrameInfo?: boolean;
  showKeyboard?: boolean;
}

/**
 * The initial application state
 */
export function getInitialAppState(): AppState {
  return {
    emuUiLoaded: false,
    ideUiLoaded: false,
    theme: "dark",
    emuViewOptions: {
      showToolbar: true,
      showStatusBar: true,
      showFrameInfo: true,
      showKeyboard: false,
    },
  };
}
