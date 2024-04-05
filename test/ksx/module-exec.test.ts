import "mocha";
import { expect } from "expect";
import {
  KsxModule,
  executeModule,
  isModuleErrors,
  parseKsxModule
} from "@common/ksx/ksx-module";
import {
  CancellationToken,
  EvaluationContext,
  createEvalContext
} from "@common/ksx/EvaluationContext";

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

  it("Import function #1", async () => {
    // --- Arrange
    const source = `
      import { square } from "math";
      export const x = square(10);
    `;

    const modules = {
      math: `
        export function square(x) {
          return x * x;
        }
      `
    };

    // --- Act
    const result = await execModule(source, modules);

    // --- Assert
    const moduleVars = result.evalContext.mainThread.blocks[0].vars;
    const exports = result.parsedModule.exports;
    expect(moduleVars.x).toBe(100);
    expect(exports.get("x")).toBe(100);
  });

  it("Import function #2", async () => {
    // --- Arrange
    const source = `
      import { square, factor } from "math";
      export const x = square(10) + factor;
    `;

    const modules = {
      math: `
        export const factor = 3;
        export function square(x) {
          return x * x;
        }
      `
    };

    // --- Act
    const result = await execModule(source, modules);

    // --- Assert
    const moduleVars = result.evalContext.mainThread.blocks[0].vars;
    const exports = result.parsedModule.exports;
    expect(moduleVars.x).toBe(103);
    expect(exports.get("x")).toBe(103);
  });

  it("Import function #3", async () => {
    // --- Arrange
    const source = `
      import { square, factor as f1 } from "math";
      export const x = square(10) + f1;
    `;

    const modules = {
      math: `
        export const factor = 3;
        export function square(x) {
          return x * x;
        }
      `
    };

    // --- Act
    const result = await execModule(source, modules);

    // --- Assert
    const moduleVars = result.evalContext.mainThread.blocks[0].vars;
    const exports = result.parsedModule.exports;
    expect(moduleVars.x).toBe(103);
    expect(exports.get("x")).toBe(103);
  });

  it("Import circular reference #1", async () => {
    // --- Arrange
    const source = `
      import { square, factor as f1 } from "math";
      export const x = square(10) + f1;
    `;

    const modules = {
      math: `
        import { other } from "helper";
        export const factor = 3;
        export function square(x) {
          return x * x;
        }
      `,
      helper: `
        import { factor } from "math";
        export const other = 4;
      `,
    };

    // --- Act
    const result = await execModule(source, modules);

    // --- Assert
    const moduleVars = result.evalContext?.mainThread?.blocks![0]?.vars!;
    const exports = result.parsedModule.exports;
    expect(moduleVars.x).toBe(103);
    expect(exports.get("x")).toBe(103);
  });

});

async function execModule (
  source: string,
  modules: Record<string, string> = {},
  cancellationToken?: CancellationToken
): Promise<{ evalContext: EvaluationContext; parsedModule: KsxModule }> {
  const parsedModule = await parseKsxModule(
    ROOT_MODULE,
    source,
    async (moduleName: string) => modules[moduleName] ?? null
  );

  if (isModuleErrors(parsedModule)) {
    throw new Error("Module parsing error");
  }

  const evalContext = createEvalContext({
    cancellationToken
  });

  await executeModule(parsedModule, evalContext);
  return { evalContext, parsedModule };
}
