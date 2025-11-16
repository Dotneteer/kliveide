import {
  errorResponse,
  type ApiMethodRequest,
  type ResponseMessage
} from "@messaging/messages-core";
import type { MessengerBase } from "@messaging/MessengerBase";
import type { Store } from "@state/redux-light";
import type { AppState } from "@state/AppState";
import type { IMachineService } from "../../services/IMachineService";
import { MachineCommand } from "@/common/abstractions/MachineCommand";
import { REWIND_REQUESTED } from "@/emu/machines/machine-props";

// --- Retrieves a controller error message
function noController() {
  throw new Error("Machine controller not available");
}

class EmuMessageProcessor {
  /**
   * Constructs the EmuMessageProcessor.
   * @param _mainMessenger Messenger for main process communication (reserved for future use).
   * @param machineService Service for machine operations.
   */
  constructor(
    private readonly _mainMessenger: MessengerBase,
    private readonly machineService: IMachineService
  ) {}

  /**
   * Sets the machine type and optional model/configuration.
   * @param machineId The machine type ID.
   * @param modelId Optional model ID.
   * @param config Optional configuration object.
   */
  async setMachineType(machineId: string, modelId?: string, config?: Record<string, any>) {
    await this.machineService.setMachineType(machineId, modelId, config);
  }

  /**
   * Issues a machine command, optionally with a custom command string.
   * @param command The machine command to issue.
   * @param customCommand Optional custom command string.
   */
  issueMachineCommand(command: MachineCommand, customCommand?: string) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    switch (command) {
      case "start":
        controller.start();
        break;
      case "pause":
        controller.pause();
        break;
      case "stop":
        controller.stop();
        break;
      case "reset":
        controller.cpuReset();
        break;
      case "restart":
        controller.restart();
        break;
      case "debug":
        controller.startDebug();
        break;
      case "stepInto":
        controller.stepInto();
        break;
      case "stepOver":
        controller.stepOver();
        break;
      case "stepOut":
        controller.stepOut();
        break;
      case "rewind":
        controller.machine.setMachineProperty(REWIND_REQUESTED, true);
        break;
      case "custom":
        controller.customCommand(customCommand);
        break;
    }
  }

}

/**
 * Processes EmuApi method requests coming from the main process.
 *
 * @param message The API method request message to process
 * @param _store The Redux store managing the AppState
 * @param _messenger The messenger object for sending messages from emulator to main process
 * @param machineService The IMachineService instance for machine operations
 * @returns The result of the API method call (currently always undefined)
 *
 * This function will be extended in the future to route to actual API implementations.
 * For now, it logs all incoming requests and returns undefined.
 */
export async function processEmuMessage(
  message: ApiMethodRequest,
  _store: Store<AppState>,
  messenger: MessengerBase,
  machineService: IMachineService
): Promise<ResponseMessage> {

  const emuMessageProcessor = new EmuMessageProcessor(messenger, machineService);
  const processingMethod = emuMessageProcessor[message.method];
  if (typeof processingMethod === "function") {
    try {
      // --- Call the method with the given arguments. We do not call the
      // --- function through the mainMessageProcessor instance, so we need
      // --- to pass it as the "this" parameter.
      return {
        type: "ApiMethodResponse",
        result: await (processingMethod as Function).call(emuMessageProcessor, ...message.args)
      };
    } catch (err) {
      // --- Report the error
      return errorResponse(err.toString());
    }
  }
  return errorResponse(`Unknown method ${message.method}`);
}
