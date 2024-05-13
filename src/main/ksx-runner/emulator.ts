import { CodeToInject } from "@abstractions/CodeToInject";
import { ScriptCallContext } from "./MainScriptManager";

export interface EmulatorApi {
  injectCode(code: CodeToInject): Promise<void>;
}

export function createEmulatorApi(context: ScriptCallContext): EmulatorApi {
  return {
    async injectCode(_code: CodeToInject): Promise<void> {
      context.output?.writeLine(`Injecting code into the emulator...`);
    }
  };
}