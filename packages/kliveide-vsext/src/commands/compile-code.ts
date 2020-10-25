import { Z80Assembler } from "../z80lang/assembler/assembler";
import { OutputChannel, Uri } from "vscode";

/**
 * Compiles the code
 */
export async function compileCode(uri: Uri, outChannel: OutputChannel): Promise<void> {
  // --- Initialize compilation
  const start = Date.now();
  outChannel.appendLine(`Compiling ${uri.fsPath}...`);
  const compiler = new Z80Assembler();
  const compilationOutput = compiler.compileFile(uri.fsPath);
  const compilationTime = Date.now() - start;
  if (compilationOutput.errorCount > 0) {
    outChannel.appendLine(`Compilation failed.`);
    for (const errorInfo of compilationOutput.errors) {
      outChannel.appendLine(`${errorInfo.errorCode}: ${errorInfo.message} [line ${errorInfo.line}]`);
    }
  } else {
    outChannel.appendLine(`Compilation succeeded.`);
  }
  outChannel.appendLine(`Compilation time: ${compilationTime} ms`);
}
