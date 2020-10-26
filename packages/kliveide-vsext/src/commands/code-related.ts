import { Z80Assembler } from "../z80lang/assembler/assembler";
import {
  AssemblerOutput,
  SpectrumModelType,
} from "../z80lang/assembler/assembler-in-out";
import { OutputChannel, Uri, window, Event, EventEmitter } from "vscode";
import {
  getLastConnectedState,
  getLastExecutionState,
  getLastMachineType,
} from "../emulator/notifier";
import { CodeToInject, communicatorInstance } from "../emulator/communicator";

let codeInjected: EventEmitter<CodeToInject> = new EventEmitter<
  CodeToInject
>();

/**
 * Fires when code has been injected
 */
export const onCodeInjected: Event<CodeToInject> = codeInjected.event;

/**
 * Carries out code compilation
 * @param uri Code file URI
 * @param outChannel Output channel for messages
 * @returns True, if compilation successful; otherwise, false
 */
export async function compileCodeCommand(
  uri: Uri,
  outChannel: OutputChannel
): Promise<AssemblerOutput | null> {
  const start = Date.now();
  const filename = uri.fsPath;
  outChannel.appendLine(`Compiling ${filename}...`);
  const compiler = new Z80Assembler();
  let compilationOutput: AssemblerOutput | null = compiler.compileFile(
    uri.fsPath
  );
  const compilationTime = Date.now() - start;
  if (compilationOutput.errorCount > 0) {
    outChannel.appendLine(`Compilation failed.`);
    for (const errorInfo of compilationOutput.errors) {
      outChannel.appendLine(
        `${errorInfo.errorCode}: ${errorInfo.message} (${filename}:${errorInfo.line})`
      );
    }
    compilationOutput = null;
  } else {
    outChannel.appendLine(`Compilation succeeded.`);
  }
  outChannel.appendLine(`Compilation time: ${compilationTime} ms`);
  return compilationOutput;
}

/**
 * Carries out code compilation and injects the code into the ZX Spectrum
 * machine
 * @param uri Code file URI
 * @param outChannel Output channel for messages
 * @param isInInjectMode Indicates of the command is executed in inject mode
 * @returns True, if compilation successful; otherwise, false
 */
export async function injectCodeCommand(
  uri: Uri,
  output: OutputChannel,
  isInInjectMode: boolean = true
): Promise<boolean> {
  const compilerOutput = await compileCodeCommand(uri, output);

  if (!compilerOutput || compilerOutput.errorCount > 0) {
    window.showErrorMessage("Code compilation failed, no program to inject.");
    return false;
  }

  if (!isModelCompatibleWith(getLastMachineType(), compilerOutput.modelType)) {
    window.showErrorMessage(
      "The current machine type of the emulator is not " +
        "compatible with the compiled program's ZX Spectrum machine type."
    );
    return false;
  }

  let sumCodeLength = 0;
  compilerOutput.segments.forEach(
    (s) => (sumCodeLength += s.emittedCode.length)
  );
  if (sumCodeLength === 0) {
    window.showWarningMessage(
      "The length of the compiled code is 0, " +
        "so there is no code to inject into the virtual machine."
    );
  }

  // --- Put the machine into the appropriate state for injection
  if (isInInjectMode) {
    const isPaused =
      getLastConnectedState() && getLastExecutionState().state === "paused";
    if (!isPaused) {
      window.showErrorMessage(
        "To inject the code into the virtual machine, please put it in pauses state first."
      );
      return false;
    }
  } else {
    await communicatorInstance.stopMachine();
  }

  // TODO: Start the machine

  // --- Inject the code in the emulator
  if (isInInjectMode) {
    const codeToInject: CodeToInject = {
      model: modelTypeToMachineType(compilerOutput.modelType),
      segments: compilerOutput.segments.map((s) => ({
        startAddress: s.startAddress,
        bank: s.bank,
        bankOffset: s.bankOffset,
        emittedCode: s.emittedCode,
      })),
      options: compilerOutput.injectOptions,
    };
    communicatorInstance.injectCode(codeToInject);
  }

  window.showInformationMessage(
    "Code successfully injected into the ZX Spectrum emulator."
  );
  return false;

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

/**
 * Compiles the code, injects it into the virtual machine, and then, runs it
 * @param uri Code file URI
 * @param outChannel Output channel for messages
 */
export async function runCodeCommand(
  uri: Uri,
  output: OutputChannel
): Promise<void> {
  await injectCodeCommand(uri, output, false);
}

/**
 * Compiles the code, injects it into the virtual machine, and then, starts it
 * in debug mode
 * @param uri Code file URI
 * @param outChannel Output channel for messages
 */
export async function debugCodeCommand(
  uri: Uri,
  output: OutputChannel
): Promise<void> {
  await injectCodeCommand(uri, output, false);
}

/**
 * Tests if the specified model name is compatible with the given model type
 * @param modelName Model name to test
 * @param modelType Output model type
 */
export function isModelCompatibleWith(
  modelName: string,
  modelType: SpectrumModelType
): boolean {
  switch (modelType) {
    case SpectrumModelType.Next:
      return modelName === "next";
    case SpectrumModelType.SpectrumP3:
      return modelName === "p3";
    case SpectrumModelType.Spectrum128:
      return modelName === "128";
    case SpectrumModelType.Spectrum48:
      return true;
    default:
      return false;
  }
}
