import { dispatch, getState } from "@core/service-registry";
import {
  spectrumLoadModeAction,
  spectrumTapeContentsAction,
  spectrumTapeLoadedAction,
} from "@state/spectrum-specific-reducer";
import { emuSetMessageAction } from "@state/emulator-panel-reducer";
import { IZxSpectrumStateManager, ZX_SPECTRUM_STATE_MANAGER_ID } from "./ZxSpectrumCoreBase";
import { IMachineComponentProvider } from "@modules-core/abstract-vm";

export class ZxSpectrumStateManager implements IMachineComponentProvider, IZxSpectrumStateManager {
  readonly id = ZX_SPECTRUM_STATE_MANAGER_ID;
  
  /**
   * Gets the current state
   */
  getState(): any {
    return getState();
  }

  /**
   * Sets the tape contents
   * @param contents Tape contents
   */
  setTapeContents(contents: Uint8Array): void {
    dispatch(spectrumTapeContentsAction(contents));
  }

  /**
   * Emulator panel message on the UI
   * @param message Panel message
   */
  setPanelMessage(message: string): void {
    dispatch(emuSetMessageAction(message));
  }

  /**
   * Sets the current load mode
   * @param isLoad Is in load mode?
   */
  setLoadMode(isLoad: boolean): void {
    dispatch(spectrumLoadModeAction(isLoad));
  }

  /**
   * Initiates the loading of the tape
   */
  initiateTapeLoading(): void {
    dispatch(spectrumTapeLoadedAction());
  }
}
