import type { ScriptCallContext } from "@main/ksx-runner/MainScriptManager";

import { createZccRunner } from "./Zcc";
import { CompilerFunction } from "@main/cli-integration/CliRunner";

function createCompiler(context: ScriptCallContext): CompilerFunction {
  return async (filename, options, target) => {
    // --- Display compilation message
    const out = context.output;
    await out.color("bright-blue");
    await out.write("Start compiling ");
    await out.write(
      filename,
      {
        type: "@navigate",
        payload: { file: filename }
      },
      true
    );
    await out.writeLine();
    await out.resetStyle();

    // --- Do the compilation
    const runner = createZccRunner(context.state.project?.folderPath, target, options, [filename]);
    const result = await runner.execute();

    // --- Display the result
    // --- Display optional trace output
    const traceOutput = result?.traceOutput;
    if (traceOutput?.length > 0) {
      await out.resetStyle();
      for (let i = 0; i < traceOutput.length; i++) {
        const lines = traceOutput[i].split("\n");
        for (let j = 0; j < lines.length - 1; j++) {
          await out.writeLine(lines[j]);
        }
      }
    }

    // --- Collect errors
    result.errorCount = result?.errors?.filter((m) => !m.isWarning).length ?? 0;

    if (result.failed) {
      // --- Some unexpected error with the compilation
      await out.color("bright-red");
      await out.bold(true);
      const lines = result.failed.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        out.writeLine(lines[i]);
      }
      out.resetStyle();
      return result;
    }

    // --- Display the errors
    if ((result.errors?.length ?? 0) > 0) {
      for (let i = 0; i < result.errors.length; i++) {
        const err = result.errors[i];
        await out.color(err.isWarning ? "yellow" : "bright-red");
        await out.bold(true);
        await out.write(`${err.errorCode}: ${err.message}`);
        await out.write(" - ");
        await out.bold(false);
        await out.color("bright-cyan");
        const file = err.filename;
        const line = err.line;
        const column = err.startColumn;
        if (line !== undefined && line >= 0) {
          await out.write(
            `${file}${line != undefined ? ` (${line}:${column + 1})` : ""}`,
            {
              type: "@navigate",
              payload: { file, line, column }
            },
            true
          );
        } else {
          await out.write(
            file,
            {
              type: "@navigate",
              payload: { file }
            },
            true
          );
        }
        await out.writeLine();
        await out.resetStyle();
      }
    }

    // --- Done
    return result;
  };
}

export function createZ88dk(context: ScriptCallContext) {
  return {
    compile: async (filename: string, options: Record<string, any>, target: string) => {
      const compiler = createCompiler(context);
      return await compiler(filename, options, target);
    }
  };
}
