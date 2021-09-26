import * as path from "path";

import { app, dialog } from "electron";
import { AppWindow } from "./app-window";
import { __DARWIN__ } from "../utils/electron-utils";
import {
  RequestMessage,
  StopVmRequest,
} from "../../shared/messaging/message-types";
import {
  MachineContextProvider,
  MachineContextProviderBase,
} from "../../extensibility/main/machine-context";
import { MachineCreationOptions } from "../../renderer/machines/core/vm-core-types";
import {
  emuMachineContextAction,
  emuSetBaseFrequencyAction,
  emuSetExecutionStateAction,
  emuSetExtraFeaturesAction,
} from "../../shared/state/emulator-panel-reducer";
import { emuMessenger, setEmuForwarder, setEmuMessenger } from "./app-menu";
import { AppState } from "../../shared/state/AppState";
import {
  appSettings,
  KliveProject,
  KliveSettings,
  reloadSettings,
  saveKliveSettings,
  saveSettingsToFile,
} from "../main-state/klive-configuration";
import { emuFocusAction } from "../../shared/state/emu-focus-reducer";
import { MainToEmuForwarder } from "../communication/MainToEmuForwarder";
import { machineRegistry } from "../../extensibility/main/machine-registry";
import {
  ZxSpectrum128ContextProvider,
  ZxSpectrum48ContextProvider,
} from "../../extensibility/main/zx-spectrum-context";
import { Cz88ContextProvider } from "../../extensibility/main/cz88-context";
import { MainToEmulatorMessenger } from "../communication/MainToEmulatorMessenger";
import { PROJECT_FILE } from "../project/project-utils";
import { dispatch, getState } from "../main-state/main-store";

/**
 * These are the context providers we usein the code
 */
export const _: typeof MachineContextProviderBase[] = [
  ZxSpectrum48ContextProvider,
  ZxSpectrum128ContextProvider,
  Cz88ContextProvider,
];

/**
 * Represents the singleton emulator window
 */
export class EmuWindow extends AppWindow {
  private _machineContextProvider: MachineContextProvider;

  /**
   * Initializes the window instance
   */
  constructor() {
    super(true);
    setEmuMessenger(new MainToEmulatorMessenger(this.window));
    setEmuForwarder(new MainToEmuForwarder(this.window));
  }

  /**
   * Get the machine context provider of this instance
   */
  get machineContextProvider(): MachineContextProvider {
    return this._machineContextProvider;
  }

  /**
   * The name of the file that provides the window's contents
   */
  get contentFile(): string {
    return "emu-index.html";
  }

  /**
   * The file to store the window state
   */
  get stateFile(): string {
    return "emu-window-state.json";
  }

  /**
   * The window has been closed
   */
  onClosed(): void {
    app.quit();
  }

  /**
   * The window receives the focus
   */
  onFocus() {
    super.onFocus();
    dispatch(emuFocusAction(true));
  }

  /**
   * The window loses the focus
   */
  onBlur() {
    super.onBlur();
    dispatch(emuFocusAction(false));
  }

  /**
   * Saves the current application settings
   */
  saveAppSettings(): void {
    const state = getState() as AppState;
    const machineType = state.machineType.split("_")[0];
    const kliveSettings: KliveSettings = {
      machineType,
      viewOptions: {
        showToolbar: state.emuViewOptions.showToolbar,
        showFrameInfo: state.emuViewOptions.showFrameInfo,
        showKeyboard: state.emuViewOptions.showKeyboard,
        showStatusbar: state.emuViewOptions.showStatusBar,
        keyboardHeight: state.emulatorPanel.keyboardHeight,
      },
    };
    if (this._machineContextProvider) {
      kliveSettings.machineSpecific = appSettings?.machineSpecific;
      if (!kliveSettings.machineSpecific) {
        kliveSettings.machineSpecific = {};
      }
      kliveSettings.machineSpecific[machineType] =
        this._machineContextProvider.getMachineSpecificSettings();
    }
    saveKliveSettings(kliveSettings);
    reloadSettings();
  }

  /**
   * Saves the project file changes to the current Klive project
   */
  saveKliveProject(): void {
    const project = getState().project;
    if (!project?.hasVm || !project?.path) {
      // --- No VM in the current project, nothing to save
      return;
    }

    const state = getState();
    const machineType = state.machineType.split("_")[0];
    const kliveSettings: KliveProject = {
      machineType,
      viewOptions: {
        showToolbar: state.emuViewOptions.showToolbar,
        showFrameInfo: state.emuViewOptions.showFrameInfo,
        showKeyboard: state.emuViewOptions.showKeyboard,
        showStatusbar: state.emuViewOptions.showStatusBar,
        keyboardHeight: state.emulatorPanel.keyboardHeight,
      },
    };
    if (this._machineContextProvider) {
      kliveSettings.machineSpecific =
        this._machineContextProvider.getMachineSpecificSettings();
    }
    const projectFile = path.join(project.path, PROJECT_FILE);
    saveSettingsToFile(kliveSettings, projectFile);
  }

  // ==========================================================================
  // IEmuAppWindow implementation

  /**
   * Posts a message from the renderer to the main
   * @param _message Message contents
   */
  postMessageToEmulator(_message: RequestMessage): void {}

  /**
   * Requests a machine type according to its menu ID
   * @param id Machine type, or menu ID of the machine type
   * @param options Machine construction options
   */
  async requestMachineType(
    id: string,
    options?: MachineCreationOptions,
    settings?: KliveSettings
  ): Promise<void> {
    // Preparation: Stop the current machine
    emuMessenger.sendMessage(<StopVmRequest>{
      type: "StopVm",
    });

    // Use only the first segment of the ID
    id = id.split("_")[0];

    // #1: Create the context provider for the machine
    const contextProvider = machineRegistry.get(id)?.implementor;
    if (!contextProvider) {
      this.showError(
        `Cannot find a context provider for '${id}'.`,
        "Internal error"
      );
      return;
    }

    // #2: Set up the firmware
    this._machineContextProvider = new (contextProvider as any)(
      options
    ) as MachineContextProvider;
    const firmware = this._machineContextProvider.getFirmware(options);
    if (typeof firmware === "string") {
      this.showError(`Cannot load firmware: ${firmware}.`, "Internal error");
      return;
    }

    // #3: Set up machine-specific settings
    let extraOptions: MachineCreationOptions | null = null;
    if (settings) {
      extraOptions =
        await this._machineContextProvider.setMachineSpecificSettings(settings);
    }

    // #4: Instantiate the machine
    const creationOptions = {
      ...options,
      firmware,
      ...extraOptions,
    } as MachineCreationOptions;
    const requestMessage: RequestMessage = {
      type: "CreateMachine",
      machineId: id,
      options: creationOptions,
    };
    await emuMessenger.sendMessage(requestMessage);

    // #4: Sign extra machine features
    dispatch(
      emuSetExtraFeaturesAction(
        this._machineContextProvider.getExtraMachineFeatures()
      )
    );

    // #5: Set up the machine specific description
    dispatch(
      emuMachineContextAction(
        this._machineContextProvider.getMachineContextDescription()
      )
    );
    dispatch(
      emuSetBaseFrequencyAction(
        this._machineContextProvider.getNormalCpuFrequency()
      )
    );

    // #6: Set the default execution state
    dispatch(emuSetExecutionStateAction(0));
  }

  // ==========================================================================
  // Helpers

  /**
   * Ensures that the Emulator UI is started
   */
  async ensureStarted(): Promise<void> {
    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (getState().emuUiLoaded) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });
  }

  /**
   * Displays an error message in a pop-up
   * @param message
   */
  async showError(message: string, title = "Error"): Promise<void> {
    await dialog.showMessageBox(this.window, {
      title,
      message,
      type: "error",
    });
  }
}
