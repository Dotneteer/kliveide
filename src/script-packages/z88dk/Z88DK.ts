import { SimpleAssemblerOutput } from "../../main/compiler-integration/compiler-registry";
import { createZccRunner } from "./Zcc";

export const Z88DK = {
  createCompiler,
};

type CompilerFunction = (
  filename: string,
  options?: Record<string, any>,
  target?: string
) => Promise<SimpleAssemblerOutput | null>;

function createCompiler(): CompilerFunction {
  return async (filename, options, target) => {
    const runner = createZccRunner(target, options, [filename]);
    return await runner.execute();
  };
}
