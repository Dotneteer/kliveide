import * as path from "path";
import * as electronLocalShortcut from "electron-localshortcut";

import {
  BrowserWindow,
  BrowserWindowConstructorOptions,
} from "electron";
import { __DARWIN__, __LINUX__, __WIN32__ } from "../utils/electron-utils";
import { registerService, STORE_SERVICE } from "@extensibility/service-registry";
import { mainStore } from "../main-state/main-store";

registerService(STORE_SERVICE, mainStore);

/**
 * Stores a reference to the lazily loaded `electron-window-state` package.
 */
let windowStateKeeper: any | null = null;

/**
 * Represents an application window as a base class for the
 * Emulator and IDE windows.
 */
export abstract class AppWindow {
  static focusedWindow: AppWindow | null = null;

  // --- The associated BrowserWindow instance
  private _window: BrowserWindow | null;

  /**
   * Initializes an instance
   */
  constructor(showWindow: boolean) {
    // --- Setup the state keeper module
    if (!windowStateKeeper) {
      windowStateKeeper = require("electron-window-state");
    }

    // --- Restore the last window state
    const savedWindowState = windowStateKeeper({
      defaultWidth: this.minimumWidth,
      defaultHeight: this.minimumHeight,
      file: this.stateFile,
    });

    // --- Instantiate the window
    const window = (this._window = new BrowserWindow(
      this.getWindowOptions(savedWindowState, showWindow)
    ));

    // --- Allow the `electron-windows-state` package to follow and save the
    // --- app window's state
    savedWindowState.manage(this._window);

    // --- Set up event handlers
    window.on("focus", () => this.onFocus());
    window.on("blur", () => this.onBlur());
    window.on("enter-full-screen", () => this.onEnterFullScreen());
    window.on("leave-full-screen", () => this.onLeaveFullScreen());
    window.on("maximize", () => this.onMaximize());
    window.on("minimize", () => this.onMinimize());
    window.on("unmaximize", () => this.onUnmaximize());
    window.on("restore", () => this.onRestore());
    window.on("hide", () => this.onHide());
    window.on("show", () => this.onShow());
    window.on("closed", () => this.onClosed());
  }

  /**
   * Gets the associated BrowserWindow
   */
  get window(): BrowserWindow | null {
    return this._window;
  }

  /**
   * Hide this window
   */
  hide(): void {
    this.window.hide();
  }

  /**
   * Show this window
   */
  show(): void {
    this.window.show();
  }

  /**
   * Loads the contenst of the main window
   */
  load(): void {
    this._window.loadFile(path.join(__dirname, this.contentFile));
  }

  // ==========================================================================
  // Members to override

  /**
   * The name of the file that provides the window's contents
   */
  abstract get contentFile(): string;

  /**
   * The file to store the window state
   */
  get stateFile(): string {
    return "window-state.json";
  }

  /**
   * Override this getter to specify the minimum window width
   */
  get minimumWidth(): number {
    return 640;
  }

  /**
   * Override this getter to specify the minimum window height
   */
  get minimumHeight(): number {
    return 480;
  }

  /**
   * Gets the options this window should be created
   * @param savedWindowState
   * @returns
   */
  getWindowOptions(savedWindowState: any, showWindow: boolean): BrowserWindowConstructorOptions {
    const windowOptions: BrowserWindowConstructorOptions = {
      x: savedWindowState.x,
      y: savedWindowState.y,
      width: savedWindowState.width,
      height: savedWindowState.height,
      minWidth: this.minimumWidth,
      minHeight: this.minimumHeight,
      show: showWindow,
      // --- This fixes subpixel aliasing on Windows
      // --- See https://github.com/atom/atom/commit/683bef5b9d133cb194b476938c77cc07fd05b972
      backgroundColor: "#fff",
      webPreferences: {
        webSecurity: false,
        devTools: process.env.NODE_ENV === "production" ? false : true,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.bundled.js"),
      },
      acceptFirstMouse: true,
      icon: path.join(__dirname, "icons/spectnet-logo.png"),
    };

    // --- Additional options depending on the host platform
    if (__DARWIN__) {
      windowOptions.frame = true;
    } else if (__WIN32__) {
      windowOptions.frame = true;
    } else if (__LINUX__) {
      windowOptions.icon = path.join(__dirname, "icons/spectnet-logo.png");
    }
    return windowOptions;
  }

  // --------------------------------------------------------------------------
  // Window event handlers

  /**
   * The window receives the focus
   */
  onFocus(): void {
    AppWindow.focusedWindow = this;
    electronLocalShortcut.register(
      this._window,
      ["CommandOrControl+R", "CommandOrControl+Shift+R", "F5"],
      () => {}
    );
  }

  /**
   * The window loses the focus
   */
  onBlur(): void {
    AppWindow.focusedWindow = null;
    electronLocalShortcut.unregisterAll(this._window);
  }

  /**
   * The window enters full screen mode
   */
  onEnterFullScreen(): void {
    // --- Override it in derived classes
  }

  /**
   * The window enters full screen mode
   */
  onLeaveFullScreen(): void {
    // --- Override it in derived classes
  }

  /**
   * The window has been maximized
   */
  onMaximize(): void {
    // --- Override it in derived classes
  }

  /**
   * The window has been minimized
   */
  onMinimize(): void {
    // --- Override it in derived classes
  }

  /**
   * The window has been unmaximized
   */
  onUnmaximize(): void {
    // --- Override it in derived classes
  }

  /**
   * The window has been restored
   */
  onRestore(): void {
    // --- Override it in derived classes
  }

  /**
   * The window has been hidden
   */
  onHide(): void {
    // --- Override it in derived classes
  }

  /**
   * The window has been displayed
   */
  onShow(): void {
    // --- Override it in derived classes
  }

  /**
   * The window has been closed
   */
  onClosed(): void {
    this._window = null;
  }
}

