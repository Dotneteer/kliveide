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
import { ZxSpectrumBase } from "../native/api/Z80VmBase";
import { getMachineTypeIdFromName } from "../shared/spectrum/machine-types";
import {
  InjectProgramCommand,
  MemoryCommand,
  RunProgramCommand,
} from "../shared/state/AppState";
import { memorySetResultAction } from "../shared/state/redux-memory-command-state";
import { codeInjectResultAction } from "../shared/state/redux-code-command-state";
import { codeRunResultAction } from "../shared/state/redux-run-code-state";

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
 * Last emulator command requested
 */
let lastMemoryCommand: MemoryCommand | undefined;

/**
 * Last code injection command requested
 */
let lastInjectCommand: InjectProgramCommand | undefined;

/**
 * Last run program command requested
 */
let lastRunCommand: RunProgramCommand | undefined;

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

  // --- Process server-api memory commands
  if (lastMemoryCommand !== state.memoryCommand) {
    lastMemoryCommand = state.memoryCommand;
    if (lastMemoryCommand && lastMemoryCommand.command) {
      let contents = new Uint8Array(0);
      switch (lastMemoryCommand.command) {
        case "rom":
          contents = spectrumEngine.getRomPage(lastMemoryCommand.index ?? 0);
          break;
        case "bank":
          contents = spectrumEngine.getBankPage(lastMemoryCommand.index ?? 0);
          break;
      }
      stateAware.dispatch(
        memorySetResultAction(lastMemoryCommand.seqNo, contents)()
      );
    }
  }

  // --- Process code injection commands
  if (lastInjectCommand !== state.injectCommand) {
    lastInjectCommand = state.injectCommand;
    if (lastInjectCommand && lastInjectCommand.codeToInject) {
      const result = await spectrumEngine.injectCode(
        lastInjectCommand.codeToInject
      );
      if (result) {
        stateAware.dispatch(codeInjectResultAction(result)());
      } else {
        stateAware.dispatch(codeInjectResultAction("")());
      }
    }
  }

  // --- Process run program commands
  if (lastRunCommand !== state.runCommand) {
    lastRunCommand = state.runCommand;
    if (lastRunCommand && lastRunCommand.codeToInject) {
      console.log("Executing the run command");
      const result = await spectrumEngine.runCode(
        lastRunCommand.codeToInject,
        lastRunCommand.debug
      );
      if (result) {
        stateAware.dispatch(codeRunResultAction(result)());
      } else {
        stateAware.dispatch(codeRunResultAction("")());
      }
    }
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
    case 2:
    case 3:
      const rom0 = await fetch("./roms/sp128-0.rom");
      const buffer0 = Buffer.from((await rom0.body.getReader().read()).value);
      const rom1 = await fetch("./roms/sp128-1.rom");
      const buffer1 = Buffer.from((await rom1.body.getReader().read()).value);
      spectrum = new ZxSpectrum128(machineApi, [buffer0, buffer1]);
      break;
    default:
      const rom = await fetch("./roms/sp48.rom");
      const buffer = Buffer.from((await rom.body.getReader().read()).value);
      spectrum = new ZxSpectrum48(machineApi, [buffer]);
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
