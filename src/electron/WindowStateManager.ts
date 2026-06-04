import { BrowserWindow, screen, type Rectangle } from "electron";
import type { WindowState } from "./WindowState";

const EVENT_HANDLING_DELAY = 100;

type ManagedWindowState = Partial<WindowState> & Pick<WindowState, "width" | "height">;

type WindowStateManager = {
  get x(): number | undefined;
  get y(): number | undefined;
  get width(): number;
  get height(): number;
  get displayBounds(): Rectangle | undefined;
  get isMaximized(): boolean;
  get isFullScreen(): boolean;
  saveState: (win?: BrowserWindow) => void;
  unmanage: () => void;
  manage: (win: BrowserWindow) => void;
  resetStateToDefault: () => void;
};

type ManageOptions = {
  defaultWidth?: number;
  defaultHeight?: number;
  maximize?: boolean;
  fullScreen?: boolean;
  stateSaver?: (state: WindowState) => void;
};

export function createWindowStateManager(
  storedState: WindowState | undefined,
  options: ManageOptions
): WindowStateManager {
  let state: ManagedWindowState = storedState ?? getDefaultState();
  let stateChangeTimer: NodeJS.Timeout | undefined;
  let winRef: BrowserWindow | null = null;

  validateState();
  state = {
    ...state,
    width: state.width || options.defaultWidth || 800,
    height: state.height || options.defaultHeight || 600
  };

  return {
    get x(): number | undefined {
      return state.x;
    },
    get y(): number | undefined {
      return state.y;
    },
    get width(): number {
      return state.width;
    },
    get height(): number {
      return state.height;
    },
    get displayBounds(): Rectangle | undefined {
      return state.displayBounds;
    },
    get isMaximized(): boolean {
      return !!state.isMaximized;
    },
    get isFullScreen(): boolean {
      return !!state.isFullScreen;
    },
    saveState,
    unmanage,
    manage,
    resetStateToDefault
  };

  function getDefaultState(): ManagedWindowState {
    return {
      width: options.defaultWidth || 800,
      height: options.defaultHeight || 600,
      isFullScreen: false,
      isMaximized: false
    };
  }

  function isNormal(win: BrowserWindow): boolean {
    return !win.isMaximized() && !win.isMinimized() && !win.isFullScreen();
  }

  function hasBounds(): boolean {
    return (
      Number.isInteger(state.x) &&
      Number.isInteger(state.y) &&
      Number.isInteger(state.width) &&
      state.width > 0 &&
      Number.isInteger(state.height) &&
      state.height > 0
    );
  }

  function resetStateToDefault(): void {
    const displayBounds = screen.getPrimaryDisplay().bounds;

    state = {
      width: options.defaultWidth || 800,
      height: options.defaultHeight || 600,
      x: displayBounds.x,
      y: displayBounds.y,
      displayBounds,
      isFullScreen: false,
      isMaximized: false
    };
  }

  function windowWithinBounds(bounds: Rectangle): boolean {
    return (
      state.x !== undefined &&
      state.y !== undefined &&
      state.x >= bounds.x &&
      state.y >= bounds.y &&
      state.x + state.width <= bounds.x + bounds.width &&
      state.y + state.height <= bounds.y + bounds.height
    );
  }

  function validateState(): void {
    const isValid = hasBounds() || !!state.isMaximized || !!state.isFullScreen;
    if (!isValid) {
      state = getDefaultState();
      return;
    }

    if (hasBounds() && state.displayBounds) {
      ensureWindowVisibleOnSomeDisplay();
    }
  }

  function updateState(win = winRef ?? undefined): void {
    if (!win) {
      return;
    }

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
    } catch {
      // A window may already be closing while Electron is emitting late events.
    }
  }

  function saveState(win?: BrowserWindow): void {
    updateState(win);

    if (!isCompleteState(state)) {
      return;
    }

    try {
      options.stateSaver?.(state);
    } catch {
      // Settings persistence must not interfere with normal window lifecycle.
    }
  }

  function ensureWindowVisibleOnSomeDisplay(): void {
    const visible = screen.getAllDisplays().some((display) => windowWithinBounds(display.bounds));

    if (!visible) {
      resetStateToDefault();
    }
  }

  function stateChangeHandler(): void {
    if (stateChangeTimer) {
      clearTimeout(stateChangeTimer);
    }
    stateChangeTimer = setTimeout(updateState, EVENT_HANDLING_DELAY);
  }

  function closeHandler(): void {
    updateState();
  }

  function closedHandler(): void {
    unmanage();
    saveState();
  }

  function manage(win: BrowserWindow): void {
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

  function unmanage(): void {
    if (!winRef) {
      return;
    }

    winRef.removeListener("resize", stateChangeHandler);
    winRef.removeListener("move", stateChangeHandler);
    winRef.removeListener("close", closeHandler);
    winRef.removeListener("closed", closedHandler);
    if (stateChangeTimer) {
      clearTimeout(stateChangeTimer);
    }
    winRef = null;
  }
}

function isCompleteState(state: ManagedWindowState): state is WindowState {
  return (
    Number.isInteger(state.x) &&
    Number.isInteger(state.y) &&
    Number.isInteger(state.width) &&
    Number.isInteger(state.height) &&
    typeof state.isMaximized === "boolean" &&
    typeof state.isFullScreen === "boolean" &&
    !!state.displayBounds
  );
}
