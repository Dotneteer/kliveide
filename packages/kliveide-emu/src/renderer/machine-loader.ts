import { VmEngine } from "./machines/VmEngine";
import { MachineApi } from "../native/api/api";
import { ZxSpectrum48 } from "./machines/ZxSpectrum48"
import { ZxSpectrum128 } from "./machines/ZxSpectrum128"
import {
  createRendererProcessStateAware,
  rendererProcessStore,
} from "./rendererProcessStore";
import { emulatorSetCommandAction } from "../shared/state/redux-emulator-command-state";
import { MemoryHelper } from "../native/api/memory-helpers";
import { emulatorSetSavedDataAction } from "../shared/state/redux-emulator-state";
import { TAPE_SAVE_BUFFER } from "../native/api/memory-map";
import { FrameBoundZ80Machine } from "./machines/FrameBoundZ80Machine";
import { getMachineTypeIdFromName } from "../shared/machines/machine-types";
import {
  InjectProgramCommand,
  MemoryCommand,
  RunProgramCommand,
} from "../shared/state/AppState";
import { memorySetResultAction } from "../shared/state/redux-memory-command-state";
import { codeInjectResultAction } from "../shared/state/redux-code-command-state";
import { codeRunResultAction } from "../shared/state/redux-run-code-state";
import { AudioRenderer } from "./machines/AudioRenderer";
import { ZxSpectrumBaseStateManager } from "./machines/ZxSpectrumBaseStateManager";

/**
 * Store the virtual machine engine instance
 */
let vmEngine: VmEngine | null = null;

/**
 * The WebAssembly instance with the virtual machine core
 */
let waInstance: WebAssembly.Instance | null = null;

/**
 * Loader promise
 */
let loader: Promise<VmEngine> | null = null;

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
  if (processingChange || !vmEngine) return;
  processingChange = true;

  // --- Process server-api execution state commands
  if (lastEmulatorCommand !== state.emulatorCommand) {
    lastEmulatorCommand = state.emulatorCommand;

    switch (lastEmulatorCommand) {
      case "start":
        await vmEngine.start();
        break;
      case "pause":
        await vmEngine.pause();
        break;
      case "stop":
        await vmEngine.stop();
        break;
      case "restart":
        await vmEngine.restart();
        break;
      case "start-debug":
        await vmEngine.startDebug();
        break;
      case "step-into":
        await vmEngine.stepInto();
        break;
      case "step-over":
        await vmEngine.stepOver();
        break;
      case "step-out":
        await vmEngine.stepOut();
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
          contents = vmEngine.getRomPage(lastMemoryCommand.index ?? 0);
          break;
        case "bank":
          contents = vmEngine.getBankPage(lastMemoryCommand.index ?? 0);
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
      const result = await vmEngine.injectCode(
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
      const result = await vmEngine.runCode(
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
 * Get the initialized virtual machine engine
 */
export async function getVmEngine(): Promise<VmEngine> {
  if (!vmEngine) {
    if (!loader) {
      loader = createVmEngine(0);
    }
    vmEngine = await loader;
  }
  return vmEngine;
}

export async function changeVmEngine(name: string) {
  // --- Stop the engine
  if (vmEngine) {
    await vmEngine.stop();

    // --- Allow 100 ms for pending entities to update
    await new Promise((r) => setTimeout(r, 100));
  }

  // --- Create the new engine
  waInstance = null;
  const typeId = getMachineTypeIdFromName(name);
  const newEngine = await createVmEngine(typeId);

  // --- Store it
  vmEngine = newEngine;
}

/**
 * Creates a new virtual machine engine with the provided type
 * @param type virtual machine engine type
 */
export async function createVmEngine(
  type: number
): Promise<VmEngine> {
  if (!waInstance) {
    waInstance = await createWaInstance(type);
  }
  const machineApi = (waInstance.exports as unknown) as MachineApi;

  // --- Instantiate the requested machine
  let machine: FrameBoundZ80Machine;
  switch (type) {
    case 1:
    case 2:
    case 3:
      const rom0 = await fetch("./roms/sp128-0.rom");
      const buffer0 = Buffer.from((await rom0.body.getReader().read()).value);
      const rom1 = await fetch("./roms/sp128-1.rom");
      const buffer1 = Buffer.from((await rom1.body.getReader().read()).value);
      const sp128 = new ZxSpectrum128(machineApi, [buffer0, buffer1]);
      sp128.setAudioRendererFactory((sampleRate: number) => new AudioRenderer(sampleRate));
      sp128.setStateManager(new ZxSpectrumBaseStateManager());
      machine = sp128;
      break;
    default:
      const rom = await fetch("./roms/sp48.rom");
      const buffer = Buffer.from((await rom.body.getReader().read()).value);
      const sp48 = new ZxSpectrum48(machineApi, [buffer]);
      sp48.setAudioRendererFactory((sampleRate: number) => new AudioRenderer(sampleRate));
      sp48.setStateManager(new ZxSpectrumBaseStateManager());
      machine = sp48;
      break;
  }

  // --- Create the engine and bind it with the machine
  const engine = new VmEngine(machine);
  machine.vmEngineController = engine;

  // --- Turn on the machine to intialize it, however, do not start
  machine.turnOnMachine();

  // --- Done
  return engine;
}

/**
 * Creates a WebAssembly instance with the virtual machine core
 * @param type Machine type identifier
 */
async function createWaInstance(type: number): Promise<WebAssembly.Instance> {
  const importObject = {
    imports: {
      trace: (arg: number) => console.log(arg),
      saveModeLeft: (length: number) => {
        storeSavedDataInState(length);
      },
    },
  };
  let wasmFile = "";
  switch (type) {
    case 0:
      wasmFile = "sp48.wasm";
      break;
    case 1: 
    case 2: 
    case 3: 
      wasmFile = "sp128.wasm";
      break;
    default:
      wasmFile = "sp48.wasm";
      break;
  }
  const response = await fetch("./wasm/" + wasmFile);
  return (
    await WebAssembly.instantiate(await response.arrayBuffer(), importObject)
  ).instance;
}

/**
 * Extracts saved data
 * @param length Data length
 */
function storeSavedDataInState(length: number): void {
  if (!vmEngine) {
    return;
  }

  const mh = new MemoryHelper(vmEngine.z80Machine.api, TAPE_SAVE_BUFFER);
  const savedData = new Uint8Array(mh.readBytes(0, length));
  rendererProcessStore.dispatch(emulatorSetSavedDataAction(savedData)());
}
