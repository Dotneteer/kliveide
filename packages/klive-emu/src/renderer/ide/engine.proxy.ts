import { ideToEmuMessenger } from "./IdeToEmuMessenger";

/**
 * This class allows to access the virtual machine engine from the IDE process
 */
class EngineProxy {
  async getRegisters(): Promise<void> {
    ideToEmuMessenger.sendMessage({
      type: "GetRegisters",
    });
  }
}

/**
 * The singleton instance of the engine proxy
 */
export const engineProxy = new EngineProxy();
