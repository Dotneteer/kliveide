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
import { getMachineTypeIdFromName } from "../shared/spectrum/machine-types";

/**
 * Store the ZX Spectrum engine instance
 */
let spectrumEngine: SpectrumEngine | null = null;

/**
 * The WebAssembly instance with the ZX Spectrum core
 */
let waInstance: WebAssembly.Instance | null = null;

/**
 * Loader promise
 */
let loader: Promise<SpectrumEngine> | null = null;

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
  if (processingChange || !spectrumEngine) return;
  processingChange = true;

  // --- Process server-api execution state commands
  if (lastEmulatorCommand !== state.emulatorCommand) {
    lastEmulatorCommand = state.emulatorCommand;

    switch (lastEmulatorCommand) {
      case "start":
        await spectrumEngine.start();
        break;
      case "pause":
        await spectrumEngine.pause();
        break;
      case "stop":
        await spectrumEngine.stop();
        break;
      case "restart":
        await spectrumEngine.restart();
        break;
      case "start-debug":
        await spectrumEngine.startDebug();
        break;
      case "step-into":
        await spectrumEngine.stepInto();
        break;
      case "step-over":
        await spectrumEngine.stepOver();
        break;
      case "step-out":
        await spectrumEngine.stepOut();
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
  if (!spectrumEngine) {
    if (!loader) {
      loader = createSpectrumEngine(0);
    }
    spectrumEngine = await loader;
  }
  return spectrumEngine;
}

export async function changeSpectrumEngine(name: string) {
  // --- Stop the engine
  if (spectrumEngine) {
    await spectrumEngine.stop();

    // --- Allow 100 ms for pending entities to update
    await new Promise((r) => setTimeout(r, 100));
  }

  // --- Create the new engine
  const typeId = getMachineTypeIdFromName(name);
  const newEngine = await createSpectrumEngine(typeId);

  // --- Store it
  spectrumEngine = newEngine;
}

/**
 * Creates a new ZX Spectrum engine with the provided type
 * @param type Spectrum engine type
 */
export async function createSpectrumEngine(
  type: number
): Promise<SpectrumEngine> {
  if (!waInstance) {
    waInstance = await createWaInstance();
  }
  const machineApi = (waInstance.exports as unknown) as MachineApi;
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
  if (!spectrumEngine) {
    return;
  }

  const mh = new MemoryHelper(spectrumEngine.spectrum.api, TAPE_SAVE_BUFFER);
  const savedData = new Uint8Array(mh.readBytes(0, length));
  rendererProcessStore.dispatch(emulatorSetSavedDataAction(savedData)());
}
