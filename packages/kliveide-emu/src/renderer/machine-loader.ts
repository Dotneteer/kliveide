import { VmEngine } from "./machines/VmEngine";
import { MachineApi } from "./machines/wa-api";
import { ZxSpectrum48 } from "./machines/ZxSpectrum48";
import { ZxSpectrum128 } from "./machines/ZxSpectrum128";
import {
  createRendererProcessStateAware,
  rendererProcessStore,
} from "./rendererProcessStore";
import { emulatorSetCommandAction } from "../shared/state/redux-emulator-command-state";
import { MemoryHelper } from "./machines/memory-helpers";
import { emulatorSetSavedDataAction } from "../shared/state/redux-emulator-state";
import { TAPE_SAVE_BUFFER } from "./machines/memory-map";
import { FrameBoundZ80Machine } from "./machines/FrameBoundZ80Machine";
import {
  InjectProgramCommand,
  MemoryCommand,
  RunProgramCommand,
} from "../shared/state/AppState";
import { memorySetResultAction } from "../shared/state/redux-memory-command-state";
import { AudioRenderer } from "./machines/AudioRenderer";
import { ZxSpectrumBaseStateManager } from "./machines/ZxSpectrumBaseStateManager";
import { CambridgeZ88 } from "./machines/CambridgeZ88";
import { KliveConfiguration } from "../shared/messaging/emu-configurations";

/**
 * The configuration of the emulator app
 */
export let emulatorAppConfig: KliveConfiguration | null = null;

/**
 * Set the emulator configuration
 */
export function setEmulatorAppConfig(config: KliveConfiguration): void {
  emulatorAppConfig = config;
}

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

  processingChange = false;
});

/**
 * Get the initialized virtual machine engine
 */
export async function getVmEngine(): Promise<VmEngine> {
  if (!vmEngine) {
    if (!loader) {
      loader = createVmEngine("48");
    }
    vmEngine = await loader;
  }
  return vmEngine;
}

export async function changeVmEngine(typeId: string) {
  // --- Stop the engine
  if (vmEngine) {
    await vmEngine.stop();

    // --- Allow 100 ms for pending entities to update
    await new Promise((r) => setTimeout(r, 100));
  }

  // --- Create the new engine
  waInstance = null;
  const newEngine = await createVmEngine(typeId);

  // --- Store it
  vmEngine = newEngine;
}

/**
 * Creates a new virtual machine engine with the provided type
 * @param type virtual machine engine type
 */
export async function createVmEngine(typeId: string): Promise<VmEngine> {
  if (!waInstance) {
    waInstance = await createWaInstance(typeId);
  }
  const machineApi = (waInstance.exports as unknown) as MachineApi;

  // --- Instantiate the requested machine
  let machine: FrameBoundZ80Machine;
  switch (typeId) {
    case "128": {
      const buffer0 = await readFromStream("./roms/sp128-0.rom");
      const buffer1 = await readFromStream("./roms/sp128-1.rom");
      const sp128 = new ZxSpectrum128(machineApi, [buffer0, buffer1]);
      sp128.setAudioRendererFactory(
        (sampleRate: number) => new AudioRenderer(sampleRate)
      );
      sp128.setStateManager(new ZxSpectrumBaseStateManager());
      machine = sp128;
      break;
    }
    case "cz88": {
      const buffer = await readFromStream("./roms/Z88OZ47.rom");
      machine = new CambridgeZ88(machineApi, [buffer]);
      console.log("Z88 loaded.");
      break;
    }
    default: {
      const buffer = await readFromStream("./roms/sp48.rom");
      const sp48 = new ZxSpectrum48(machineApi, [buffer]);
      sp48.setAudioRendererFactory(
        (sampleRate: number) => new AudioRenderer(sampleRate)
      );
      sp48.setStateManager(new ZxSpectrumBaseStateManager());
      machine = sp48;
      break;
    }
  }

  // --- Create the engine and bind it with the machine
  const engine = new VmEngine(machine);
  machine.vmEngineController = engine;

  // --- Done
  return engine;
}

/**
 * Creates a WebAssembly instance with the virtual machine core
 * @param type Machine type identifier
 */
async function createWaInstance(typeId: string): Promise<WebAssembly.Instance> {
  const importObject = {
    imports: {
      trace: (arg: number) => console.log(arg),
      saveModeLeft: (length: number) => {
        storeSavedDataInState(length);
      },
      opCodeFetched,
      standardOpExecuted,
      extendedOpExecuted,
      indexedOpExecuted,
      bitOpExecuted,
      indexedBitOpExecuted,
      intExecuted,
      nmiExecuted,
      halted,
      memoryRead,
      memoryWritten,
      ioRead,
      ioWritten,
    },
  };
  let wasmFile = "";
  switch (typeId) {
    case "48":
      wasmFile = "sp48.wasm";
      break;
    case "128":
      wasmFile = "sp128.wasm";
      break;
    case "cz88":
      wasmFile = "cz88.wasm";
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

/**
 * Read data from the specified URI
 * @param uri URI to read form
 */
async function readFromStream(uri: string): Promise<Buffer> {
  const buffers: Buffer[] = [];
  const data = await fetch(uri);
  let done = false;
  const reader = data.body.getReader();
  do {
    const read = await reader.read();
    if (read.value) {
      buffers.push(Buffer.from(read.value));
    }
    done = read.done;
  } while (!done);
  return Buffer.concat(buffers);
}

// ============================================================================
// CPU hook methods

/**
 * CPU hook. Invoked when the CPU fetches an operation code
 * @param opCode The fetched operation code
 * @param pcAfter The value of PC after the fetch operation
 */
function opCodeFetched(opCode: number, pcAfter: number): void {
  vmEngine.z80Machine.opCodeFetched(opCode, pcAfter);
}

/**
 * CPU hook. Invoked when the CPU has completed a standard instruction
 * @param opCode The fetched operation code
 * @param pcAfter The value of PC after the operation
 */
function standardOpExecuted(opCode: number, pcAfter: number): void {
  vmEngine.z80Machine.standardOpExecuted(opCode, pcAfter);
}

/**
 * CPU hook. Invoked when the CPU has completed an extended instruction
 * @param opCode The fetched operation code
 * @param pcAfter The value of PC after the operation
 */
function extendedOpExecuted(opCode: number, pcAfter: number): void {
  vmEngine.z80Machine.extendedOpExecuted(opCode, pcAfter);
}

/**
 * CPU hook. Invoked when the CPU has completed an IX-indexed instruction
 * @param opCode The fetched operation code
 * @param indexMode The index mode: IX=0, IY=1
 * @param pcAfter The value of PC after the operation
 */
function indexedOpExecuted(
  opCode: number,
  indexMode: number,
  pcAfter: number
): void {
  vmEngine.z80Machine.indexedOpExecuted(opCode, indexMode, pcAfter);
}

/**
 * CPU hook. Invoked when the CPU has completed a bit instruction
 * @param opCode The fetched operation code
 * @param pcAfter The value of PC after the operation
 */
function bitOpExecuted(opCode: number, pcAfter: number): void {
  vmEngine.z80Machine.bitOpExecuted(opCode, pcAfter);
}

/**
 * CPU hook. Invoked when the CPU has completed an IX-indexed bit
 * instruction
 * @param opCode The fetched operation code
 * @param indexMode The index mode: IX=0, IY=1
 * @param pcAfter The value of PC after the operation
 */
function indexedBitOpExecuted(
  opCode: number,
  indexMode: number,
  pcAfter: number
): void {
  vmEngine.z80Machine.indexedBitOpExecuted(opCode, indexMode, pcAfter);
}

/**
 * CPU hook. Invoked when a maskable interrupt is about to be executed
 * @param pcInt The value of PC that points to the beginning of the
 * interrupt routine
 */
function intExecuted(pcInt: number): void {
  vmEngine.z80Machine.intExecuted(pcInt);
}

/**
 * CPU hook. Invoked when a non-maskable interrupt is about to be executed
 * interrupt routine
 */
function nmiExecuted(): void {
  vmEngine.z80Machine.nmiExecuted();
}

/**
 * CPU hook. Invoked when the CPU has been halted.
 * @param pcHalt The value of PC that points to the HALT statement
 * interrupt routine
 */
function halted(pcHalt: number): void {
  vmEngine.z80Machine.halted(pcHalt);
}

/**
 * CPU hook. Invoked when the CPU reads memory while processing a statement
 * @param address The memory address read
 * @param value The memory value read
 */
function memoryRead(address: number, value: number): void {
  vmEngine.z80Machine.memoryRead(address, value);
}

/**
 * CPU hook. Invoked when the CPU writes memory while processing a statement
 * @param address The memory address read
 * @param value The memory value read
 */
function memoryWritten(address: number, value: number): void {
  vmEngine.z80Machine.memoryWritten(address, value);
}

/**
 * CPU hook. Invoked when the CPU reads from an I/O port
 * @param address The memory address read
 * @param value The memory value read
 */
function ioRead(address: number, value: number): void {
  vmEngine.z80Machine.ioRead(address, value);
}

/**
 * CPU hook. Invoked when the CPU writes to an I/O port
 * @param address The memory address read
 * @param value The memory value read
 */
function ioWritten(address: number, value: number): void {
  vmEngine.z80Machine.ioWritten(address, value);
}
