import { MachineInfo } from "@/abstractions/MachineInfo";
import { FileProvider } from "@/core/FileProvider";
import { IZ80Machine } from "@/emu/abstractions/IZ80Machine";
import { MachineController } from "@/emu/machines/controller/MachineController";
import { DebugSupport } from "@/emu/machines/DebugSupport";
import { FILE_PROVIDER, AUDIO_SAMPLE_RATE } from "@/emu/machines/machine-props";
import { LiteEvent } from "@/emu/utils/lite-event";
import { machineRegistry } from "@/registry";
import { MessageSource } from "@common/messaging/messages-core";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { setMachineTypeAction } from "@common/state/actions";
import { AppState } from "@common/state/AppState";
import { Store, Unsubscribe } from "@common/state/redux-light";
import {
  IMachineService,
  MachineTypeEventHandler,
  MachineInstanceEventHandler
} from "./abstrations/IMachineService";

class MachineService implements IMachineService {
  private _oldDisposing = new LiteEvent<string>();
  private _oldDisposed = new LiteEvent<string>();
  private _newInitializing = new LiteEvent<IZ80Machine>();
  private _newInitialized = new LiteEvent<IZ80Machine>();
  private _controller?: MachineController;
  private _machineId?: string;

  /**
   * Initializes the machine service to use the specified store
   * @param store Store to use for managing the state
   */
  constructor (
    private readonly store: Store<AppState>,
    private readonly messenger: MessengerBase,
    private readonly messageSource: MessageSource
  ) {}

  /**
   * Sets the machine to to the specified one
   * @param machineId ID of the machine type to set
   */
  async setMachineType (machineId: string): Promise<void> {
    // --- Check if machine type is available
    const machineInfo = machineRegistry.find(m => m.machineId === machineId);
    if (!machineInfo) {
      throw new Error(
        `Cannot find machine type '${machineId}' in the registry.`
      );
    }

    // --- Ok, dismount the old machine type
    if (this._controller) {
      this._oldDisposing.fire(this._controller.machine.machineId);
      await this._controller.stop();
      this._controller.dispose();
      this._oldDisposed.fire(this._machineId);
      this._controller = undefined;
    }

    // --- Initialize the new machine
    const machine = machineInfo.factory();
    this._controller = new MachineController(
      this.store,
      this.messenger,
      machine
    );
    this._controller.debugSupport = new DebugSupport(this.store);
    this._newInitializing.fire(machine);

    // --- Seup the machine
    machine.setMachineProperty(FILE_PROVIDER, new FileProvider(this.messenger));
    machine.setMachineProperty(
      AUDIO_SAMPLE_RATE,
      this.store.getState()?.emulatorState?.audioSampleRate
    );
    await machine.setup();
    this._newInitialized.fire(machine);

    // --- Ready, sign the machine type state change
    this.store.dispatch(setMachineTypeAction(machineId), this.messageSource);
  }

  /**
   * Gets the current machine type
   */
  getMachineType (): string | undefined {
    return this.store.getState()?.emulatorState?.machineId;
  }

  /**
   * Gets descriptive information about the current machine
   */
  getMachineInfo (): MachineInfo | undefined {
    const currentType = this.store.getState()?.emulatorState?.machineId;
    return machineRegistry.find(m => m.machineId === currentType);
  }

  /**
   * Gets the current machine controller instance
   */
  getMachineController (): MachineController | undefined {
    return this._controller;
  }

  /**
   * Subscribes to an event when the old machine type is about to being disposed
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  oldMachineTypeDisposing (handler: MachineTypeEventHandler): Unsubscribe {
    this._oldDisposing.on(handler);
    return () => this._oldDisposing.off(handler);
  }

  /**
   * Subscribes to an event when the old machine type has been disposed
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  oldMachineTypeDisposed (handler: MachineTypeEventHandler): Unsubscribe {
    this._oldDisposed.on(handler);
    return () => this._oldDisposed.off(handler);
  }

  /**
   * Subscribes to an event when the new machine type is about to being initialized
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  newMachineTypeInitializing (
    handler: MachineInstanceEventHandler
  ): Unsubscribe {
    this._newInitializing.on(handler);
    return () => this._newInitializing.off(handler);
  }

  /**
   * Subscribes to an event when the new machine type have been initialized
   * @param handler Function handling machine type change
   * @returns An unsubscribe function
   */
  newMachineTypeInitialized (handler: MachineInstanceEventHandler): Unsubscribe {
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
export function createMachineService (
  store: Store<AppState>,
  messenger: MessengerBase,
  messageSource: MessageSource
) {
  return new MachineService(store, messenger, messageSource);
}
