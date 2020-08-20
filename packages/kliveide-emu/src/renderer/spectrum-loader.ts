import { SpectrumEngine } from "./spectrum/SpectrumEngine";
import { MachineApi } from "../native/api/api";
import { ZxSpectrum48 } from "../native/api/ZxSpectrum48";
import { ZxSpectrum128 } from "../native/api/ZxSpectrum128";
import {
  createRendererProcessStateAware,
  rendererProcessStore,
} from "./rendererProcessStore";
import { emulatorSetCommandAction } from "../shared/state/redux-emulator-command-state";
import { MemoryHelper } from "../native/api/memory-helpers";
import { emulatorSetSavedDataAction } from "../shared/state/redux-emulator-state";
import { TAPE_SAVE_BUFFER } from "../native/api/memory-map";
import { ZxSpectrumBase } from "../native/api/ZxSpectrumBase";

/**
 * Store the ZX Spectrum engine instance
 */
let _spectrumEngine: SpectrumEngine | null = null;

/**
 * Loader promise
 */
let _loader: Promise<SpectrumEngine> | null = null;
/**
 * Last emulator command requested
 */
let lastEmulatorCommand = "";

/**
 * Indicates that the engine is processing a state change
 */
let processingChange = false;

/**
 * Let's handle virtual machine commands
 */
const stateAware = createRendererProcessStateAware();
stateAware.stateChanged.on(async (state) => {
  if (processingChange || !_spectrumEngine) return;
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

/**
 * Get the initialized ZX Spectrum engine
 */
export async function getSpectrumEngine(): Promise<SpectrumEngine> {
  if (!_spectrumEngine) {
    if (!_loader) {
      _loader = createSpectrumEngine(0);
    }
    _spectrumEngine = await _loader;
  }
  return _spectrumEngine;
}

/**
 * Creates a new ZX Spectrum engine with the provided type
 * @param type Spectrum engine type
 */
export async function createSpectrumEngine(
  type: number
): Promise<SpectrumEngine> {
  const waInst = await createWaInstance();
  const machineApi = (waInst.exports as unknown) as MachineApi;
  let spectrum: ZxSpectrumBase;
  switch (type) {
    case 1:
      spectrum = new ZxSpectrum128(machineApi);
      break;
    default:
      spectrum = new ZxSpectrum48(machineApi);
      break;
  }
  spectrum.setUlaIssue(3);
  spectrum.turnOnMachine();
  return new SpectrumEngine(spectrum);
}

/**
 * Creates a WebAssembly instance with the ZX Spectrum Emulator core
 */
async function createWaInstance(): Promise<WebAssembly.Instance> {
  const importObject = {
    imports: {
      trace: (arg: number) => console.log(arg),
      saveModeLeft: (length: number) => {
        storeSavedDataInState(length);
      },
    },
  };
  const response = await fetch("./wasm/spectrum.wasm");
  return (
    await WebAssembly.instantiate(await response.arrayBuffer(), importObject)
  ).instance;
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
