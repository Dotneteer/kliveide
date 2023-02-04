import { BrowserWindow, Rectangle } from "electron";
import { screen } from "electron";

const EVENT_HANDLING_DELAY = 100;

export interface IWindowStateManager {
  get x(): number;
  get y(): number;
  get width(): number;
  get height(): number;
  get displayBounds(): Rectangle;
  get isMaximized(): boolean;
  get isFullScreen(): boolean;
  saveState: (win: BrowserWindow) => void;
  unmanage: () => void;
  manage: (win: BrowserWindow) => void;
  resetStateToDefault: () => void;
}

export type ManageOptions = {
  defaultWidth?: number;
  defaultHeight?: number;
  maximize?: boolean;
  fullScreen?: boolean;
  stateSaver?: (state: WindowState) => void;
};

export type WindowState = {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
  displayBounds: Rectangle;
};

export function createWindowStateManager (
  storedState: WindowState,
  options: ManageOptions
): IWindowStateManager {
  let state: WindowState = storedState;
  let stateChangeTimer: NodeJS.Timeout;
  let winRef: BrowserWindow;

  // --- Check state validity
  validateState();

  // --- Set state fallback values
  state = {
    width: options.defaultWidth || 800,
    height: options.defaultHeight || 600,
    ...state
  };

  return {
    get x (): number {
      return state.x;
    },
    get y (): number {
      return state.y;
    },
    get width (): number {
      return state.width;
    },
    get height (): number {
      return state.height;
    },
    get displayBounds (): Rectangle {
      return state.displayBounds;
    },
    get isMaximized (): boolean {
      return state.isMaximized;
    },
    get isFullScreen (): boolean {
      return state.isFullScreen;
    },
    saveState,
    unmanage,
    manage,
    resetStateToDefault
  };

  // --- Tests if the window is in normal state
  function isNormal (win: BrowserWindow) {
    return (
      !win.isMaximized() && !win.isMinimized() && !win.isFullScreen()
    );
  }

  // --- Tests if the current state has bounds
  function hasBounds (): boolean {
    return (
      state &&
      Number.isInteger(state.x) &&
      Number.isInteger(state.y) &&
      Number.isInteger(state.width) &&
      state.width > 0 &&
      Number.isInteger(state.height) &&
      state.height > 0
    );
  }

  // --- Resets the screen state to its default values
  function resetStateToDefault (): void {
    const displayBounds = screen.getPrimaryDisplay().bounds;

    // Reset state to default values on the primary display
    state = {
      width: options.defaultWidth || 800,
      height: options.defaultHeight || 600,
      x: 0,
      y: 0,
      displayBounds,
      isFullScreen: false,
      isMaximized: false
    };
  }

  // --- Tests if the current window is within the specified bounds
  function windowWithinBounds (bounds: Rectangle): boolean {
    return (
      state.x >= bounds.x &&
      state.y >= bounds.y &&
      state.x + state.width <= bounds.x + bounds.width &&
      state.y + state.height <= bounds.y + bounds.height
    );
  }

  // --- Do not allow the window an invalid state
  function validateState () {
    const isValid =
      state && (hasBounds() || state.isMaximized || state.isFullScreen);
    if (!isValid) {
      state = null;
      return;
    }

    if (hasBounds() && state.displayBounds) {
      ensureWindowVisibleOnSomeDisplay();
    }
  }

  // --- Update the managed windiw's state
  function updateState (win?: BrowserWindow): void {
    win ||= winRef;
    if (!win) {
      return;
    }
    // --- Don't throw an error when window was closed
    try {
      const winBounds = win.getBounds();
      if (isNormal(win)) {
        state.x = winBounds.x;
        state.y = winBounds.y;
        state.width = winBounds.width;
        state.height = winBounds.height;
      }
      state.isMaximized = win.isMaximized();
      state.isFullScreen = win.isFullScreen();
      state.displayBounds = screen.getDisplayMatching(winBounds).bounds;
    } catch (err) {}
  }

  function saveState (win?: BrowserWindow) {
    // --- Update window state
    updateState(win);

    // --- Save state
    try {
      options?.stateSaver?.(state);
    } catch (err) {
      // --- Don't care
    }
  }

  // --- Ensure the window is visible
  function ensureWindowVisibleOnSomeDisplay () {
    const visible = screen.getAllDisplays().some(display => {
      return windowWithinBounds(display.bounds);
    });

    if (!visible) {
      // --- Window is partially or fully not visible now.
      return resetStateToDefault();
    }
  }

  // --- Handle window state changes
  function stateChangeHandler () {
    clearTimeout(stateChangeTimer);
    stateChangeTimer = setTimeout(updateState, EVENT_HANDLING_DELAY);
  }

  function closeHandler () {
    updateState();
  }

  function closedHandler () {
    // Unregister listeners and save state
    unmanage();
    saveState();
  }

  function manage (win: BrowserWindow) {
    if (options.maximize && state.isMaximized) {
      win.maximize();
    }
    if (options.fullScreen && state.isFullScreen) {
      win.setFullScreen(true);
    }
    win.on("resize", stateChangeHandler);
    win.on("move", stateChangeHandler);
    win.on("close", closeHandler);
    win.on("closed", closedHandler);
    winRef = win;
  }

  function unmanage () {
    if (winRef) {
      winRef.removeListener("resize", stateChangeHandler);
      winRef.removeListener("move", stateChangeHandler);
      clearTimeout(stateChangeTimer);
      winRef.removeListener("close", closeHandler);
      winRef.removeListener("closed", closedHandler);
      winRef = null;
    }
  }
}
