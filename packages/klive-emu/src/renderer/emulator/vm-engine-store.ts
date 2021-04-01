import { StateAwareObject } from "../../shared/state/StateAwareObject";
import { ILiteEvent, LiteEvent } from "../../shared/utils/LiteEvent";
import { ZxSpectrum128Core } from "../machines/spectrum/ZxSpectrum128Core";
import { ZxSpectrum48Core } from "../machines/spectrum/ZxSpectrum48Core";
import { VirtualMachineCoreBase } from "../machines/VirtualMachineCoreBase";
import {
  MachineCreationOptions,
  MachineState,
} from "../machines/vm-core-types";
import { VmStateChangedArgs } from "../machines/VmController";
import { emuStore } from "./emuStore";

/**
 * Represents the virtual machine engine
 */
export interface IVmEngineStore {
  /**
   * Sets the engine to the specified one
   * @param id Machine model identifier
   * @param options Machine configuration to create
   */
  setEngine(id: string, options: MachineCreationOptions): void;

  /**
   * Gets the current engine
   */
  getEngine(): VirtualMachineCoreBase;

  /**
   * Indicates if the engine has already been created
   */
  readonly hasEngine: boolean;

  /**
   * Gets the error message of the virtual machine engine
   */
  readonly vmEngineError: string | null;

  /**
   * Indicates that the virtual machine engine has been changed
   */
  readonly vmEngineChanged: ILiteEvent<string>;

  /**
   * Indicates that the virtual machine screen has been refreshed
   */
  readonly screenRefreshed: ILiteEvent<void>;

  /**
   * Indicates that the virtual machine has a new UI message
   */
  readonly uiMessageChanged: ILiteEvent<void>;

  /**
   * Indicates that the virtual machine execution state has changed
   */
  readonly executionStateChanged: ILiteEvent<VmStateChangedArgs>;

  /**
   * Gets the current internal state of the virtual machine
   */
  getMachineState(): MachineState;

  /**
   * Current screen width;
   */
  readonly screenWidth: number;

  /**
   * Current screen height;
   */
  readonly screenHeight: number;

  /**
   * Sets the machine's current audio rate
   * @param rate
   */
  setAudioSampleRate(rate: number): void;

  /**
   * Gets the screen pixels data to display
   */
  getScreenData(): Uint32Array;
}

/**
 * Default implementation of IVmEngineStore
 */
class VmEngineStore implements IVmEngineStore {
  private _vmEngine: VirtualMachineCoreBase;

  private _stateAware: StateAwareObject<string>;
  private _vmEngineChanged = new LiteEvent<string>();
  private _vmScreenRefreshed = new LiteEvent<void>();
  private _uiMessageChanged = new LiteEvent<void>();
  private _executionStateChanged = new LiteEvent<VmStateChangedArgs>();

  constructor() {
    this._stateAware = new StateAwareObject<string>(emuStore, "machineType");
    this._stateAware.stateChanged.on(() => {
      const state = this._stateAware.state;
      console.log(`Machine types: ${state}`);
    });
  }

  /**
   * Gets the current engine
   */
  getEngine(): VirtualMachineCoreBase {
    if (this._vmEngine) {
      return this._vmEngine;
    }
    throw new Error("The is now virtual machine engine set");
  }

  /**
   * Sets the engine to the specified one
   * @param id Machine engine
   */
  setEngine(id: string, options: MachineCreationOptions): void {
    const engineEntry = engineRegistry[id];
    if (!engineEntry) {
      // TODO: issue error message
      return;
    }

    // --- Create the machine engine
    const engine = new (engineEntry as any)(options) as VirtualMachineCoreBase;
    this._vmEngine = engine;
    this._vmEngineChanged.fire(this._vmEngine.modelId);
  }

  /**
   * Indicates if the engine has already been created
   */
  get hasEngine(): boolean {
    return !!this._vmEngine;
  }

  /**
   * Gets the error message of the virtual machine engine
   */
  get vmEngineError(): string | null {
    // TODO: Implement this method
    throw new Error("Not implemented yet");
  }

  /**
   * Indicates if the virtual machine engine has been changed
   */
  get vmEngineChanged(): ILiteEvent<string> {
    return this._vmEngineChanged;
  }

  /**
   * Indicates that the virtual machine screen has been refreshed
   */
  get screenRefreshed(): ILiteEvent<void> {
    return this._vmScreenRefreshed;
  }

  /**
   * Indicates that the virtual machine has a new UI message
   */
  get uiMessageChanged(): ILiteEvent<void> {
    return this._uiMessageChanged;
  }

  /**
   * Indicates that the virtual machine execution state has changed
   */
  get executionStateChanged(): ILiteEvent<VmStateChangedArgs> {
    return this._executionStateChanged;
  }

  /**
   * Gets the current internal state of the virtual machine
   */
  getMachineState(): MachineState {
    // TODO: Implement this method
    throw new Error("Not implemented yet");
  }

  /**
   * Current screen width;
   */
  get screenWidth(): number {
    // TODO: Implement this method
    throw new Error("Not implemented yet");
  }

  /**
   * Current screen height;
   */
  get screenHeight(): number {
    // TODO: Implement this method
    throw new Error("Not implemented yet");
  }

  /**
   * Sets the machine's current audio rate
   * @param rate
   */
  setAudioSampleRate(rate: number): void {
    // TODO: Implement this method
  }

  /**
   * Gets the screen pixels data to display
   */
  getScreenData(): Uint32Array {
    // TODO: Implement this method
    throw new Error("Not implemented yet");
  }
}

/**
 * The IVmEngineStore instance to use
 */
export const vmEngineStore: IVmEngineStore = new VmEngineStore();

/**
 * Registry of virtual machine engines
 */
export const engineRegistry: Record<string, typeof VirtualMachineCoreBase> = {
  sp48: ZxSpectrum48Core,
  sp128: ZxSpectrum128Core,
};
