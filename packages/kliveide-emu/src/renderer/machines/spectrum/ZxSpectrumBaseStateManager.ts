import {
  emulatorLoadTapeAction,
  emulatorSelectRomAction,
  emulatorSetLoadModeAction,
  emulatorSetPanelMessageAction,
  emulatorSetTapeContenstAction,
} from "@state/redux-emulator-state";
import { rendererProcessStore } from "../../rendererProcessStore";
import { IZxSpectrumBaseStateManager } from "../IZxSpectrumBaseStateManager";

export class ZxSpectrumBaseStateManager implements IZxSpectrumBaseStateManager {
  /**
   * Gets the current state
   */
  getState(): any {
    return rendererProcessStore.getState();
  }

  /**
   * Sets the tape contents
   * @param contents Tape contents
   */
  setTapeContents(contents: Uint8Array): void {
    rendererProcessStore.dispatch(emulatorSetTapeContenstAction(contents)());
  }

  /**
   * Emulator panel message on the UI
   * @param message Panel message
   */
  setPanelMessage(message: string): void {
    rendererProcessStore.dispatch(emulatorSetPanelMessageAction(message)());
  }

  /**
   * Selects the specified ROM
   * @param rom ROM index
   */
  selectRom(rom: number): void {
    rendererProcessStore.dispatch(emulatorSelectRomAction(rom)());
  }

  /**
   * Selects the specified RAM Bank
   * @param bank RAM bank index
   */
  selectBank(bank: number): void {
    rendererProcessStore.dispatch(emulatorSelectRomAction(bank)());
  }

  /**
   * Sets the current load mode
   * @param isLoad Is in load mode?
   */
  setLoadMode(isLoad: boolean): void {
    rendererProcessStore.dispatch(emulatorSetLoadModeAction(isLoad)());
  }

  /**
   * Initiates the loading of the tape
   */
  initiateTapeLoading(): void {
    rendererProcessStore.dispatch(emulatorLoadTapeAction());
  }
}
