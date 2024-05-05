import { ScriptCallContext } from "@main/ksx-runner/MainScriptManager";
import { SimpleAssemblerOutput } from "../../main/compiler-integration/compiler-registry";
import { createZccRunner } from "./Zcc";

type CompilerFunction = (
  filename: string,
  options?: Record<string, any>,
  target?: string
) => Promise<SimpleAssemblerOutput | null>;

function createCompiler(context: ScriptCallContext): CompilerFunction {
  return async (filename, options, target) => {
    // --- Display compilation message
    const out = context.output;
    out.color("bright-blue");
    out.write("Start compiling ");
    out.write(
      filename,
      {
        type: "@navigate",
        payload: { file: filename }
      },
      true
    );
    out.writeLine();
    out.resetStyle();

    // --- Do the compilation
    const runner = createZccRunner(context.state.project?.folderPath, target, options, [filename]);
    const result = await runner.execute();

    // --- Display the result
    // --- Display optional trace output
    const traceOutput = result?.traceOutput;
    if (traceOutput?.length > 0) {
      out.resetStyle();
      traceOutput.forEach((msg) => out.writeLine(msg));
    }

    // --- Collect errors
    const errorCount = result?.errors?.filter((m) => !m.isWarning).length ?? 0;

    if (result.failed) {
      if (!result || errorCount === 0) {
        // --- Some unexpected error with the compilation
        out.color("bright-red");
        out.bold(true);
        out.writeLine(result.failed);
        out.resetStyle();
        return result;
      }
    }

    // --- Display the errors
    if ((result.errors?.length ?? 0) > 0) {
      for (let i = 0; i < result.errors.length; i++) {
        const err = result.errors[i];
        out.color(err.isWarning ? "yellow" : "bright-red");
        out.bold(true);
        out.write(`${err.errorCode}: ${err.message}`);
        out.write(" - ");
        out.bold(false);
        out.color("bright-cyan");
        const file = err.filename;
        const line = err.line;
        const column = err.startColumn;
        out.write(
          `${file}${line != undefined ? ` (${line}:${column + 1})` : ""}`,
          {
            type: "@navigate",
            payload: { file, line, column }
          },
          true
        );
        out.writeLine();
        out.resetStyle();
      }
    }

    return result;
  };
}

export function createZ88dk(context: ScriptCallContext) {
  return {
    compile: (filename: string, options: Record<string, any>, target: string) => {
      const compiler = createCompiler(context);
      compiler(filename, options, target);
    }
  };
}
