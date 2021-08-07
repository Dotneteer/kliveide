import { ICpuState } from "../../shared/machines/AbstractCpu";
import { ideToEmuMessenger } from "./IdeToEmuMessenger";
import {
  GetCpuStateResponse,
  GetMachineStateResponse,
  GetMemoryContentsResponse,
} from "../../shared/messaging/message-types";
import { ILiteEvent, LiteEvent } from "../../shared/utils/LiteEvent";
import { StateAwareObject } from "../../shared/state/StateAwareObject";
import { ideStore } from "./ideStore";
import { EmulatorPanelState } from "../../shared/state/AppState";
import { MachineState } from "../machines/core/vm-core-types";

/**
 * This class allows to access the virtual machine engine from the IDE process
 */
class EngineProxy {
  private _lastExecutionState = 0;
  private _running = false;
  private _runEvent = new LiteEvent<RunEventArgs>();

  /**
   * Initializes the engine proxy
   */
  constructor() {
    const stateAware = new StateAwareObject<EmulatorPanelState>(
      ideStore,
      "emulatorPanel"
    );
    stateAware.stateChanged.on(async (emuPanel) => {
      if (this._lastExecutionState !== emuPanel.executionState) {
        this._lastExecutionState = emuPanel.executionState;
        this._runEvent.fire({
          execState: this._lastExecutionState,
          isDebug: emuPanel.runsInDebug,
        });
        if (this._lastExecutionState === 1) {
          // --- Running, periodically fire run events
          this._running = true;
          while (this._running) {
            await new Promise((r) => setTimeout(r, 200));
            if (this._running) {
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
    });
  }

  /**
   * Fires when a run event, such as execution state change or screen refresh happens
   */
  get runEvent(): ILiteEvent<RunEventArgs> {
    return this._runEvent;
  }

  /**
   * Gets the current CPU state
   * @returns
   */
  async getCpuState(): Promise<ICpuState> {
    const result = await ideToEmuMessenger.sendMessage<GetCpuStateResponse>({
      type: "GetCpuState",
    });
    return result?.state;
  }

  /**
   * Gets the current CPU state
   * @returns
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
   * Gets the memory contents of the machine
   * @returns 
   */
  async getMemoryContents(): Promise<Uint8Array> {
    const result = await ideToEmuMessenger.sendMessage<GetMemoryContentsResponse>(
      {
        type: "GetMemoryContents",
      }
    );
    return result?.contents;
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
