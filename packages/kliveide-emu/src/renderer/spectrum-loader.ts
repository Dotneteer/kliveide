import { SpectrumEngine } from "./spectrum/SpectrumEngine";
import { MachineApi } from "../native/api/api";
import { ZxSpectrum48 } from "../native/api/ZxSpectrum48";
import { createRendererProcessStateAware, rendererProcessStore } from "./rendererProcessStore";
import { emulatorSetCommandAction } from "../shared/state/redux-emulator-command-state";
import { MemoryHelper } from "../native/api/memory-helpers";
import { emulatorSetSavedDataAction } from "../shared/state/redux-emulator-state";
import { TAPE_SAVE_BUFFER } from "../native/api/memory-map";

/**
 * Store the ZX Spectrum engine instance
 */
let _spectrumEngine: SpectrumEngine | null = null;

/**
 * Async loader
 */
let _loader: Promise<void> | null = null;

/**
 * Last emulator command requested
 */
let lastEmulatorCommand = "";

/**
 * Indicates that the engine is processing a state change
 */
let processingChange = false;

/**
 * Get the initialized ZX Spectrum engine
 */
export async function getSpectrumEngine(): Promise<SpectrumEngine> {
  if (!_spectrumEngine) {
    if (!_loader) {
      _loader = loadSpectrumEngine();
    }
    await _loader;
  }
  return _spectrumEngine;
}

/**
 * Load the WebAssembly ZX Spectrum engine
 */
export async function loadSpectrumEngine(): Promise<void> {
  const importObject = {
    imports: {
      trace: (arg: number) => console.log(arg),
      saveModeLeft: (length: number) => {
        storeSavedDataInState(length);
      },
    },
  };
  try {
    const response = await fetch("./wasm/spectrum.wasm");
    const results = await WebAssembly.instantiate(
      await response.arrayBuffer(),
      importObject
    );
    const waInst = results.instance;
    const spectrum = new ZxSpectrum48(
      (waInst.exports as unknown) as MachineApi
    );
    spectrum.setUlaIssue(3);
    spectrum.turnOnMachine();
    _spectrumEngine = new SpectrumEngine(spectrum);
    const stateAware = createRendererProcessStateAware();
    stateAware.stateChanged.on(async (state) => {
      if (processingChange) return;
      processingChange = true;

      // --- Process server-api execution state commands
      if (lastEmulatorCommand !== state.emulatorCommand) {
        lastEmulatorCommand = state.emulatorCommand;

        switch (lastEmulatorCommand) {
          case "start":
            await _spectrumEngine.start();
            break;
          case "pause":
            await _spectrumEngine.pause();
            break;
          case "stop":
            await _spectrumEngine.stop();
            break;
          case "restart":
            await _spectrumEngine.restart();
            break;
          case "start-debug":
            await _spectrumEngine.startDebug();
            break;
          case "step-into":
            await _spectrumEngine.stepInto();
            break;
          case "step-over":
            await _spectrumEngine.stepOver();
            break;
          case "step-out":
            await _spectrumEngine.stepOut();
            break;
        }
        stateAware.dispatch(emulatorSetCommandAction("")());
      }
      processingChange = false;
    });
  } catch (err) {
    console.log(err);
  }
}

/**
 * Extracts saved data
 * @param length Data length
 */
function storeSavedDataInState(length: number): void {
  if (!_spectrumEngine) {
    return;
  }

  const mh = new MemoryHelper(_spectrumEngine.spectrum.api, TAPE_SAVE_BUFFER);
  const savedData = new Uint8Array(mh.readBytes(0, length));
  rendererProcessStore.dispatch(emulatorSetSavedDataAction(savedData)());
}
