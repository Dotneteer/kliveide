import { VmEngine } from "./machines/VmEngine";
import { MachineApi } from "./machines/wa-api";
import { ZxSpectrum48 } from "./machines/spectrum/ZxSpectrum48";
import { ZxSpectrum128 } from "./machines/spectrum/ZxSpectrum128";
import { rendererProcessStore } from "./rendererProcessStore";
import { MemoryHelper } from "./machines/memory-helpers";
import { emulatorSetSavedDataAction } from "../shared/state/redux-emulator-state";
import { TAPE_SAVE_BUFFER } from "./machines/memory-map";
import { FrameBoundZ80Machine } from "./machines/FrameBoundZ80Machine";
import { AudioRenderer } from "./machines/AudioRenderer";
import { ZxSpectrumBaseStateManager } from "./machines/spectrum/ZxSpectrumBaseStateManager";
import { CambridgeZ88 } from "./machines/cz88/CambridgeZ88";
import { KliveConfiguration } from "../shared/messaging/emu-configurations";
import { sendMessageToMain } from "../shared/messaging/renderer-to-main-comm";
import { GetMachineRomsResponse } from "../shared/messaging/message-types";

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
 * Error in the engine instantiation
 */
let vmEngineError: string | null = null;

/**
 * The WebAssembly instance with the virtual machine core
 */
let waInstance: WebAssembly.Instance | null = null;

/**
 * Loader promise
 */
let loader: Promise<VmEngine> | null = null;

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

/**
 * Gets the error of the vm engine
 */
export function getVmEngineError(): string | null {
  return vmEngineError;
}

/**
 * Changes the current machine type to a new one
 * @param id Machine ID with machine type and specification
 */
export async function changeVmEngine(id: string, options?: Record<string, any>) {
  // --- Stop the engine
  if (vmEngine) {
    await vmEngine.stop();
    vmEngine.dispose();
    vmEngine = null;

    // --- Allow 100 ms for pending entities to update
    await new Promise((r) => setTimeout(r, 100));
  }

  // --- Create the new engine
  waInstance = null;
  const newEngine = await createVmEngine(id, options);

  // --- Store it
  vmEngine = newEngine;
}

/**
 * Creates a new virtual machine engine with the provided type
 * @param type Virtual machine engine type and specification
 */
export async function createVmEngine(id: string, options?: Record<string, any>): Promise<VmEngine> {
  // --- Separate machine type and specification
  const typeId = id.split("_")[0];

  if (!waInstance) {
    waInstance = await createWaInstance(typeId);
  }
  const machineApi = (waInstance.exports as unknown) as MachineApi;

  // --- Instantiate the requested machine
  let machine: FrameBoundZ80Machine;

  // --- Obtain the current ROMs for the specified machine type
  const machineRoms = (
    await sendMessageToMain<GetMachineRomsResponse>({
      type: "getMachineRoms",
    })
  ).roms;

  // --- Handle ROM processing errors
  vmEngineError = null;
  if (typeof machineRoms === "string") {
    vmEngineError = machineRoms;
    return null;
  }

  // --- Now, create machine instances
  switch (typeId) {
    case "128": {
      // --- Use the ZX Spectrum 128 engine
      machine = new ZxSpectrum128(machineApi, machineRoms);

      // --- Configure factories that provide test/production separation
      (machine as ZxSpectrum128).setAudioRendererFactory(
        (sampleRate: number) => new AudioRenderer(sampleRate)
      );
      (machine as ZxSpectrum128).setStateManager(
        new ZxSpectrumBaseStateManager()
      );
      break;
    }

    case "cz88": {
      machine = new CambridgeZ88(machineApi, options, machineRoms);
      break;
    }

    default: {
      // --- By default, use ZX Spectrum 48
      machine = new ZxSpectrum48(machineApi, machineRoms);
      // --- Configure factories that provide test/production separation
      (machine as ZxSpectrum48).setAudioRendererFactory(
        (sampleRate: number) => new AudioRenderer(sampleRate)
      );
      (machine as ZxSpectrum48).setStateManager(
        new ZxSpectrumBaseStateManager()
      );
      break;
    }
  }

  if (!machine) {
    vmEngineError = "Cannot create the virtual machine.";
    return null;
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
