import { getDialogService, getState } from "@core/service-registry";

import {
  CodeInjectionType,
  CodeToInject,
  ICodeRunnerService,
} from "@abstractions/code-runner-service";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import { executeKliveCommand } from "@shared/command/common-commands";
import { SpectrumModelType } from "@abstractions/z80-compiler-service";

/**
 * Implements the behavior of the service that can run the code from the IDE
 */
export class CodeRunnerService implements ICodeRunnerService {
  /**
   * Compiles the code and injects or runs
   * @param resource Resource to compile
   * @param operationType Type of operation
   */
  async manageCodeInjection(
    resource: string,
    operationType: CodeInjectionType
  ): Promise<void> {
    injectCode(resource);
    return;

    async function injectCode(resource: string): Promise<void> {
      await executeKliveCommand("compileCode", { resource });
      const state = getState();
      const compilation = getState().compilation;
      if (!compilation) {
        return;
      }
      const result = compilation.result;
      if (result?.errors?.length ?? 0 > 0) {
        await getDialogService().showMessageBox(
          "Code compilation failed, no program to inject.",
          "Injecting code",
          "error"
        );
        return;
      }

      // TODO: Check compilation model before injection

      let sumCodeLength = 0;
      result.segments.forEach((s) => (sumCodeLength += s.emittedCode.length));
      if (sumCodeLength === 0) {
        await getDialogService().showMessageBox(
          "The length of the compiled code is 0, " +
            "so there is no code to inject into the virtual machine.",
          "Injecting code"
        );
        return;
      }

      if (operationType === "inject") {
        if (state.emulatorPanel.executionState !== 3) {
          await getDialogService().showMessageBox(
            "To inject the code into the virtual machine, please put it in paused state first.",
            "Injecting code"
          );
          return;
        }
      }

      // --- Create the code to inject into the emulator
      const codeToInject: CodeToInject = {
        model: modelTypeToMachineType(result.modelType),
        entryAddress: result.entryAddress,
        subroutine:
          result.sourceType === "zxbasic" || result.injectOptions["subroutine"],
        segments: result.segments.map((s) => ({
          startAddress: s.startAddress,
          bank: s.bank,
          bankOffset: s.bankOffset,
          emittedCode: s.emittedCode,
        })),
        options: result.injectOptions,
      };

      switch (operationType) {
        case "inject":
          await sendFromIdeToEmu({
            type: "InjectCode",
            codeToInject,
          });
          const message = `Successfully injected ${sumCodeLength} bytes in ${
            codeToInject.segments.length
          } segment${
            codeToInject.segments.length > 1 ? "s" : ""
          } from start address $${codeToInject.segments[0].startAddress
            .toString(16)
            .padStart(4, "0")
            .toUpperCase()}`;
          await getDialogService().showMessageBox(message, "Injecting code");
          break;
        case "run":
          await sendFromIdeToEmu({
            type: "RunCode",
            codeToInject,
            debug: false,
          });
          break;
        case "debug":
            await sendFromIdeToEmu({
            type: "RunCode",
            codeToInject,
            debug: true,
          });
          break;
      }
    }

    function modelTypeToMachineType(model: SpectrumModelType): string {
      switch (model) {
        case SpectrumModelType.Spectrum128:
          return "128";
        case SpectrumModelType.SpectrumP3:
          return "p3";
        case SpectrumModelType.Next:
          return "next";
        default:
          return "48";
      }
    }
  }
}
