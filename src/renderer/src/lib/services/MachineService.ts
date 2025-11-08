import { MachineController } from "../../../../emu/machines/MachineController";
import { DebugSupport } from "../../../../emu/machines/DebugSupport";
import { FILE_PROVIDER, AUDIO_SAMPLE_RATE } from "../../../../emu/machines/machine-props";
import { LiteEvent } from "../../../../emu/utils/lite-event";
import { MessageSource } from "../../../../common/messaging/messages-core";
import { MessengerBase } from "../../../../common/messaging/MessengerBase";
import { setMachineConfigAction, setMachineTypeAction, setModelTypeAction } from "../../../../common/state/actions";
import { AppState } from "../../../../common/state/AppState";
import { Store, Unsubscribe } from "../../../../common/state/redux-light";
import {
  IMachineService,
  MachineTypeEventHandler,
  MachineInstanceEventHandler
} from "./IMachineService";
import type { BreakpointInfo } from "../../../../emu/abstractions/BreakpointInfo";
import { machineRendererRegistry } from "../../../../common/machines/machine-renderer-registry";
import { machineRegistry } from "../../../../common/machines/machine-registry";
import { MachineConfigSet, MachineInfo, MachineModel } from "../../../../common/machines/info-types";
import { IAnyMachine } from "../../../../emu/abstractions/IAnyMachine";
import { FileProvider } from "./FileProvider";

class MachineService implements IMachineService {
  private _oldDisposing = new LiteEvent<string>();
  private _oldDisposed = new LiteEvent<string>();
  private _newInitializing = new LiteEvent<IAnyMachine>();
  private _newInitialized = new LiteEvent<IAnyMachine>();
  private _controller?: MachineController;

  /**
   * Initializes the machine service to use the specified store
   * @param store Store to use for managing the state
   */
  constructor(
    private readonly store: Store<AppState>,
    private readonly messenger: MessengerBase,
    private readonly messageSource: MessageSource
  ) {}

  /**
   * Sets the machine to to the specified one
   * @param machineId ID of the machine type to set
   * @param modelId ID of the machine model
   * @param config Optional machine configuration
   */
  async setMachineType(
    machineId: string,
    modelId?: string,
    config?: MachineConfigSet
  ): Promise<void> {
    // --- Check if machine type is available
    const machineInfo = machineRegistry.find(
      (m) =>
        m.machineId === machineId &&
        (!modelId || !m.models || m.models.find((m) => m.modelId === modelId))
    );
    if (!machineInfo) {
      throw new Error(`Cannot find machine type '${machineId}' in the registry.`);
    }

    // --- Get the model instance
    const modelInfo = machineInfo.models?.find((m) => m.modelId === modelId);

    // --- Ok, dismount the old machine type
    let oldBps: BreakpointInfo[] | undefined;
    if (this._controller) {
      if (this._controller.debugSupport) {
        // --- We keep the old source code breakpoints, as we want to use them in the new machine.
        oldBps = this._controller.debugSupport.breakpoints;
      }
      this._oldDisposing.fire(this._controller.machine.machineId);
      await this._controller.stop();
      this._controller.dispose();
      this._oldDisposed.fire(machineId);
      this._controller = undefined;
    }

    // --- Initialize the new machine
    const rendererInfo = machineRendererRegistry.find((r) => r.machineId === machineId);
    const machine = rendererInfo.factory(this.store, modelInfo, config, this.messenger);
    this._controller = new MachineController(this.store, this.messenger, machine);

    // --- Restore the breakpoints from the old machine
    this._controller.debugSupport = new DebugSupport(this.store, oldBps);
    this._newInitializing.fire(machine);

    // --- Seup the machine
    machine.setMachineProperty(FILE_PROVIDER, new FileProvider(this.messenger));
    machine.setMachineProperty(
      AUDIO_SAMPLE_RATE,
      this.store.getState()?.emulatorState?.audioSampleRate
    );
    await machine.setup();
    await machine.hardReset();
    this._newInitialized.fire(machine);

    // --- Ready, sign the machine type state change
    this.store.dispatch(setMachineTypeAction(machineId), this.messageSource);
    this.store.dispatch(setModelTypeAction(modelId), this.messageSource);
    this.store.dispatch(setMachineConfigAction(config || modelInfo?.config), this.messageSource);
  }

  /**
   * Gets the current machine type
   */
  getMachineType(): string | undefined {
    return this.store.getState()?.emulatorState?.machineId;
  }

  /**
   * Gets descriptive information about the current machine
   */
  getMachineInfo(): { machine: MachineInfo; model: MachineModel } | undefined {
    const currentType = this.store.getState()?.emulatorState?.machineId;
    const currentModel = this.store.getState()?.emulatorState?.modelId;
    const machine = machineRegistry.find(
      (m) =>
        m.machineId === currentType &&
        (!m.models || !currentModel || m.models?.find((m) => m.modelId === currentModel))
    );
    if (!machine) {
      return undefined;
    }
    const model = machine.models?.find((m) => m.modelId === currentModel);
    return { machine, model };
  }

  /**
   * Gets the current machine controller instance
   */
  getMachineController(): MachineController | undefined {
    return this._controller;
  }

  /**
   * Subscribes to an event when the old machine type is about to being disposed
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  oldMachineTypeDisposing(handler: MachineTypeEventHandler): Unsubscribe {
    this._oldDisposing.on(handler);
    return () => this._oldDisposing.off(handler);
  }

  /**
   * Subscribes to an event when the old machine type has been disposed
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  oldMachineTypeDisposed(handler: MachineTypeEventHandler): Unsubscribe {
    this._oldDisposed.on(handler);
    return () => this._oldDisposed.off(handler);
  }

  /**
   * Subscribes to an event when the new machine type is about to being initialized
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  newMachineTypeInitializing(handler: MachineInstanceEventHandler): Unsubscribe {
    this._newInitializing.on(handler);
    return () => this._newInitializing.off(handler);
  }

  /**
   * Subscribes to an event when the new machine type have been initialized
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  newMachineTypeInitialized(handler: MachineInstanceEventHandler): Unsubscribe {
    this._newInitialized.on(handler);
    return () => this._newInitialized.off(handler);
  }
}

/**
 * Creates a machine service instance
 * @param store State store instance
 * @param messenger Messenger instance
 * @returns Machine service instance
 */
export function createMachineService(
  store: Store<AppState>,
  messenger: MessengerBase,
  messageSource: MessageSource
) {
  return new MachineService(store, messenger, messageSource);
}
