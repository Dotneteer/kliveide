import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Z80Assembler } from "../z80lang/assembler/assembler";
import {
  AssemblerOutput,
  SpectrumModelType,
} from "../z80lang/assembler/assembler-in-out";
import {
  OutputChannel,
  Uri,
  window,
  Event,
  EventEmitter,
  commands,
} from "vscode";
import {
  getLastConnectedState,
  getLastExecutionState,
  getLastMachineType,
} from "../emulator/notifier";
import { CodeToInject, communicatorInstance } from "../emulator/communicator";
import {
  createZxbCommandLineArgs,
  execZxbc,
} from "../zxblang/compiler/zxb-runner";
import { obtainInlineOptions } from "../zxblang/compiler/utils";
import { readTextFile } from "../utils/file-utils";
import { KLIVEIDE, ZXBC_STORE_GENERATED_ASM } from "../config/sections";

let codeInjected: EventEmitter<CodeToInject> = new EventEmitter<CodeToInject>();

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
  context: vscode.ExtensionContext,
  uri: Uri,
  outChannel: OutputChannel
): Promise<AssemblerOutput | null> {
  // --- Prepare compilation
  const start = Date.now();
  let filename = uri.fsPath;
  outChannel.appendLine(`Compiling ${filename}`);

  // --- Do the compilation
  let compilationOutput: AssemblerOutput | null = null;
  const fileExt = path.extname(filename);
  let firstPhaseOk = true;
  switch (fileExt) {
    case ".zxbas":
    case ".bor":
    case ".zxb":
      // --- Calculate the output file name
      const config = vscode.workspace.getConfiguration(KLIVEIDE);
      const storeOption = config.get(ZXBC_STORE_GENERATED_ASM) as boolean;
      let outputName = filename + ".z80asm";
      if (!storeOption) {
        const folders = vscode.workspace.workspaceFolders;
        const outFolder = path.join(folders ? folders[0].uri.fsPath : path.dirname(filename), ".generated");
        if (!fs.existsSync(outFolder)) {
          fs.mkdirSync(outFolder, { recursive: true });
        }
        outputName = path.join(outFolder, path.basename(filename) + ".z80asm");
      }

      // --- Prepare the compilation
      const source = readTextFile(filename);
      const options = obtainInlineOptions(source);
      const cmdArgs = createZxbCommandLineArgs(filename, outputName, options);
      const zxbStart = Date.now();
      try {
        await execZxbc(cmdArgs, outChannel);
      } catch (err) {
        firstPhaseOk = false;
        outChannel.appendLine(err);
        break;
      }
      const zxbTime = Date.now() - zxbStart;
      outChannel.appendLine(`ZXBC execution time: ${zxbTime} ms`);

      // --- Add the .zxbasic pragma
      const output = "\t.zxbasic\r\n" + readTextFile(outputName);
      fs.writeFileSync(outputName, output);

      // --- Compile the ASM file
      filename = outputName;
      break;
  }

  if (!firstPhaseOk) {
    return null;
  }

  // --- Call the Z80 Assembler
  outChannel.appendLine("Invoking the Klive Z80 Assembler");
  const compiler = new Z80Assembler();
  compilationOutput = compiler.compileFile(filename);

  // --- Evaluate the result of compilation
  const compilationTime = Date.now() - start;
  if (!compilationOutput || compilationOutput.errorCount > 0) {
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
  context: vscode.ExtensionContext,
  uri: Uri,
  output: OutputChannel,
  codeAction?: (codeToInject: CodeToInject) => Promise<string>
): Promise<boolean> {
  const compilerOutput = await compileCodeCommand(context, uri, output);

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
  if (!codeAction) {
    const isPaused =
      getLastConnectedState() && getLastExecutionState().state === "paused";
    if (!isPaused) {
      window.showErrorMessage(
        "To inject the code into the virtual machine, please put it in pauses state first."
      );
      return false;
    }
  }

  // --- Create the code to inject into the emulator
  const codeToInject: CodeToInject = {
    model: modelTypeToMachineType(compilerOutput.modelType),
    entryAddress: compilerOutput.entryAddress,
    subroutine: compilerOutput.sourceType === "zxbasic" || compilerOutput.injectOptions["subroutine"],
    segments: compilerOutput.segments.map((s) => ({
      startAddress: s.startAddress,
      bank: s.bank,
      bankOffset: s.bankOffset,
      emittedCode: s.emittedCode,
    })),
    options: compilerOutput.injectOptions,
  };

  // --- Execute the injection action
  const injectionResult = codeAction
    ? await codeAction(codeToInject)
    : await communicatorInstance.injectCode(codeToInject);

  if (injectionResult) {
    window.showErrorMessage(injectionResult);
    return false;
  }
  window.showInformationMessage(
    "Code successfully injected into the ZX Spectrum emulator."
  );
  return true;

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
  context: vscode.ExtensionContext,
  uri: Uri,
  output: OutputChannel
): Promise<void> {
  await injectCodeCommand(
    context,
    uri,
    output,
    async (code) => await communicatorInstance.runCode(code, false)
  );
}

/**
 * Compiles the code, injects it into the virtual machine, and then, starts it
 * in debug mode
 * @param uri Code file URI
 * @param outChannel Output channel for messages
 */
export async function debugCodeCommand(
  context: vscode.ExtensionContext,
  uri: Uri,
  output: OutputChannel
): Promise<void> {
  try {
    await injectCodeCommand(
      context,
      uri,
      output,
      async (code) => await communicatorInstance.runCode(code, true)
    );
  } catch (err) {
    console.log(err.stack);
  }
}

/**
 * Executes the specified code action
 * @param action Code action to execute
 */
export async function executeCodeAction<T>(
  action: () => Promise<T>
): Promise<T> {
  commands.executeCommand("setContext", "codeAction", true);
  try {
    return await action();
  } finally {
    commands.executeCommand("setContext", "codeAction", false);
  }
}

/**
 * Tests if the specified model name is compatible with the given model type
 * @param modelName Model name to test
 * @param modelType Output model type
 */
export function isModelCompatibleWith(
  modelName: string,
  modelType?: SpectrumModelType
): boolean {
  if (modelType === undefined) {
    return true;
  }
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
