/**
 * Represents the state of the application
 */
export interface AppState {
  appHasFocus?: boolean;
  keyboardPanelState?: KeyboardPanelState;
  emulatorPanelState?: EmulatorPanelState;
}

/**
 * Represents the state of the keyboard panel
 */
export interface KeyboardPanelState {
  visible?: boolean;
}

/**
 * Represents the state of the emulator panel
 */
export interface EmulatorPanelState {
  width?: number;
  height?: number;
  zoom?: number;
}

