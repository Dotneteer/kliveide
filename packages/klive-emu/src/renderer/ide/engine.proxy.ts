import { ICpuState } from "../../shared/machines/AbstractCpu";
import { ideToEmuMessenger } from "./IdeToEmuMessenger";
import { GetCpuStateResponse } from "../../shared/messaging/message-types";

/**
 * This class allows to access the virtual machine engine from the IDE process
 */
class EngineProxy {
  async getRegisters(): Promise<ICpuState> {
    const result = await ideToEmuMessenger.sendMessage<GetCpuStateResponse>({
      type: "GetCpuState",
    });
    return result?.state;
  }
}

/**
 * The singleton instance of the engine proxy
 */
export const engineProxy = new EngineProxy();
