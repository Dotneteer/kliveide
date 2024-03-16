import "mocha";
import { expect } from "expect";
import {
  KsxModule,
  executeModule,
  isModuleErrors,
  parseKsxModule
} from "@main/ksx/ksx-module";
import { p } from "nextra/dist/types-c8e621b7";
import {
  CancellationToken,
  EvaluationContext,
  createEvalContext
} from "@main/ksx/EvaluationContext";

const ROOT_MODULE = "test";

describe("KSX Execution - modules", () => {
  it("Empty module", async () => {
    // --- Arrange
    const source = `
    `;

    // --- Act
    await execModule(source);
  });

  it("Break infinite loop", async () => {
    // --- Arrange
    const source = `
    while (true) {}
    `;

    // --- Act
    const cancellationToken = new CancellationToken();
    const moduleTask = execModule(source, {}, cancellationToken);
    const cancelPromise = new Promise(resolve =>
      setTimeout(() => {
        cancellationToken.cancel();
        resolve(true);
      }, 100)
    );
    await Promise.any([moduleTask, cancelPromise]);

    // --- Assert
    expect(cancellationToken.cancelled).toBe(true);
  });

  it("Run function", async () => {
    // --- Arrange
    const source = `
      const x = square(10);

      function square(x) {
        return x * x;
      }
    `;

    // --- Act
    const result = await execModule(source);

    // --- Assert
    const moduleVars = result.evalContext.mainThread.blocks[0].vars;
    expect(moduleVars.x).toBe(100);
  });

  it("Export const #1", async () => {
    // --- Arrange
    const source = `
      export const x = square(10);

      function square(x) {
        return x * x;
      }
    `;

    // --- Act
    const result = await execModule(source);

    // --- Assert
    const moduleVars = result.evalContext.mainThread.blocks[0].vars;
    const exports = result.parsedModule.exports;
    expect(moduleVars.x).toBe(100);
    expect(exports.get("x")).toBe(100);
  });


});

async function execModule (
  source: string,
  modules: Record<string, string> = {},
  cancellationToken?: CancellationToken
): Promise<{evalContext: EvaluationContext, parsedModule: KsxModule}> {
  const parsedModule = await parseKsxModule(
    ROOT_MODULE,
    source,
    async (moduleName: string) => modules[moduleName] ?? null
  );

  if (isModuleErrors(parsedModule)) {
    throw new Error("Module parsing error");
  }

  const evalContext = createEvalContext({
    cancellationToken,
    localContext: {},
  });
  await executeModule(parsedModule, evalContext);
  return {evalContext, parsedModule};
}
