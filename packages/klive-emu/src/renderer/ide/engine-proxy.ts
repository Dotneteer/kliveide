import { ICpuState } from "../../shared/machines/AbstractCpu";
import { ideToEmuMessenger } from "./IdeToEmuMessenger";
import {
  GetCpuStateResponse,
  GetMachineStateResponse,
  GetMemoryContentsResponse,
} from "../../shared/messaging/message-types";
import { ILiteEvent, LiteEvent } from "../../shared/utils/LiteEvent";
import { MachineState } from "../machines/core/vm-core-types";
import { getStore } from "../../shared/services/store-helpers";

/**
 * Dealy time between two timed run events
 */
const RUN_EVENT_DELAY = 800;

/**
 * This class allows to access the virtual machine engine from the IDE process
 */
class EngineProxy {
  private _lastExecutionState = 0;
  private _running = false;
  private _runEvent = new LiteEvent<RunEventArgs>();

  // --- Keep a few states cached between run events
  private _cachedCpuState: ICpuState | null = null;
  private _cachedMachineState: MachineState | null = null;
  private _cachedMemory: Uint8Array | null = null;

  /**
   * Initializes the engine proxy
   */
  constructor() {
    getStore().emulatorPanelChanged.on(async (emuPanel) => {
      if (this._lastExecutionState !== emuPanel.executionState) {
        this._lastExecutionState = emuPanel.executionState;
        this.clearCache();
        this._runEvent.fire({
          execState: this._lastExecutionState,
          isDebug: emuPanel.runsInDebug,
        });
        if (this._lastExecutionState === 1) {
          // --- Running, periodically fire run events
          this._running = true;
          while (this._running) {
            await new Promise((r) => setTimeout(r, RUN_EVENT_DELAY));
            if (this._running) {
              this.clearCache();
              this._runEvent.fire({
                execState: 1,
                isDebug: emuPanel.runsInDebug,
              });
            }
          }
        } else {
          // --- Sign that the machine is not running
          this._running = false;
        }
      }
    })
  }

  /**
   * Fires when a run event, such as execution state change or screen refresh happens
   */
  get runEvent(): ILiteEvent<RunEventArgs> {
    return this._runEvent;
  }

  /**
   * Gets the current CPU state
   */
  async getCpuState(): Promise<ICpuState> {
    const result = await ideToEmuMessenger.sendMessage<GetCpuStateResponse>({
      type: "GetCpuState",
    });
    return result?.state;
  }

  /**
   * Gets the cached CPU state
   */
  async getCachedCpuState(): Promise<ICpuState> {
    return this._cachedCpuState ?? (await this.getCpuState());
  }

  /**
   * Gets the current machine state
   */
  async getMachineState(): Promise<MachineState> {
    const result = await ideToEmuMessenger.sendMessage<GetMachineStateResponse>(
      {
        type: "GetMachineState",
      }
    );
    return result?.state;
  }

  /**
   * Gets the cached machine state
   */
  async getCachedMachineState(): Promise<MachineState> {
    return this._cachedMachineState ?? (await this.getMachineState());
  }

  /**
   * Gets the memory contents of the machine
   */
  async getMemoryContents(): Promise<Uint8Array> {
    const result =
      await ideToEmuMessenger.sendMessage<GetMemoryContentsResponse>({
        type: "GetMemoryContents",
      });
    return result?.contents;
  }

  /**
   * Gets the cached memory contents of the machine
   */
  async getCachedMemoryContents(): Promise<Uint8Array> {
    return this._cachedMemory ?? (await this.getMemoryContents());
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  // --- Dispose cached data
  private clearCache(): void {
    this._cachedCpuState = null;
    this._cachedMachineState = null;
    this._cachedMemory = null;
  }
}

/**
 * The singleton instance of the engine proxy
 */
export const engineProxy = new EngineProxy();

/**
 * Arguments of RunEvent
 */
export type RunEventArgs = { execState: number; isDebug: boolean };
