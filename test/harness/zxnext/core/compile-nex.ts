import { dirname } from "node:path";
import { readFile } from "node:fs/promises";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { NexFileWriter } from "@main/z80-compiler/nex-file-writer";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { loadNexFileContents, type NexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";

/** Machine model number the assembler uses for the ZX Spectrum Next. */
const NEXT_MODEL = 4;

export type CompiledNex = {
  bytes: Uint8Array;
  contents: NexFileContents;
};

/**
 * Compiles a Klive Z80 assembly file that carries `.savenex` pragmas into `.nex` bytes.
 *
 * The same two pieces the IDE uses (`Z80Assembler` + `NexFileWriter.fromAssemblerOutput`), so a
 * test program builds exactly as it would through `klive.build`. The result is re-parsed with the
 * NEX viewer's own parser: a file that parser rejects is a harness bug, and failing here names it.
 */
export async function compileNexFile(sourcePath: string): Promise<CompiledNex> {
  const options = new AssemblerOptions();
  options.currentModel = NEXT_MODEL;
  const output = await new Z80Assembler().compileFile(sourcePath, options);
  if (output.errors.length > 0) {
    const lines = output.errors.map(
      (e) => `  ${e.filename ?? sourcePath}:${e.line}:${e.startColumn} ${e.errorCode}: ${e.message}`
    );
    throw new Error(`Assembly of ${sourcePath} failed:\n${lines.join("\n")}`);
  }
  const bytes = await NexFileWriter.fromAssemblerOutput(output, dirname(sourcePath), async (f) =>
    new Uint8Array(await readFile(f))
  );
  const parsed = loadNexFileContents(bytes);
  if (parsed.error || !parsed.fileInfo) {
    throw new Error(`The NEX produced from ${sourcePath} does not parse: ${parsed.error}`);
  }
  return { bytes, contents: parsed.fileInfo };
}
