import { IZxSpectrumStateManager } from "./IZxSpectrumStateManager";
import { spectrumLoadModeAction, spectrumTapeContentsAction, spectrumTapeLoadedAction } from "../../../shared/state/spectrum-specific-reducer";
import { emuStore } from "../../emulator/emuStore";
import { emuSetMessageAction } from "../../../shared/state/emulator-panel-reducer";

export class ZxSpectrumStateManager implements IZxSpectrumStateManager {
  /**
   * Gets the current state
   */
  getState(): any {
    return emuStore.getState();
  }

  /**
   * Sets the tape contents
   * @param contents Tape contents
   */
  setTapeContents(contents: Uint8Array): void {
    emuStore.dispatch(spectrumTapeContentsAction(contents));
  }

  /**
   * Emulator panel message on the UI
   * @param message Panel message
   */
  setPanelMessage(message: string): void {
    emuStore.dispatch(emuSetMessageAction(message));
  }

  /**
   * Sets the current load mode
   * @param isLoad Is in load mode?
   */
  setLoadMode(isLoad: boolean): void {
    emuStore.dispatch(spectrumLoadModeAction(isLoad));
  }

  /**
   * Initiates the loading of the tape
   */
  initiateTapeLoading(): void {
    emuStore.dispatch(spectrumTapeLoadedAction());
  }
}
