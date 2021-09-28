import { IZxSpectrumStateManager } from "./IZxSpectrumStateManager";
import {
  spectrumLoadModeAction,
  spectrumTapeContentsAction,
  spectrumTapeLoadedAction,
} from "../../../shared/state/spectrum-specific-reducer";
import { emuSetMessageAction } from "../../../shared/state/emulator-panel-reducer";
import { dispatch, getState } from "../../../abstractions/service-helpers";

export class ZxSpectrumStateManager implements IZxSpectrumStateManager {
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
