import "mocha";
import { expect } from "expect";
import {
  KsxModule,
  ModuleErrors,
  isModuleErrors,
  parseKsxModule
} from "@common/ksx/ksx-module";

const ROOT_MODULE = "test";

describe("KSX Parser - modules", () => {
  it("Empty module", async () => {
    // --- Arrange
    const source = `
    `;

    // --- Act
    const result = await parseModule(source);

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);
  });

  it("Module functions", async () => {
    // --- Arrange
    const source = `
      const a = 1;
      function func1() {}
      function func2() {}
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.statements.length).toBe(3);
    expect(Object.keys(result.functions).length).toBe(2);
    expect(result.functions["func1"]).toBeDefined();
    expect(result.functions["func2"]).toBeDefined();
  });

  it("Function exports #1", async () => {
    // --- Arrange
    const source = `
      const a = 1;
      export function func1() {}
      function func2() {}
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(1);
    expect(result.exports.has("func1")).toBe(true);
  });

  it("Function exports #2", async () => {
    // --- Arrange
    const source = `
      const a = 1;
      function func1() {}
      export function func2() {}
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(1);
    expect(result.exports.has("func2")).toBe(true);
  });

  it("Function exports #3", async () => {
    // --- Arrange
    const source = `
      const a = 1;
      export function func1() {}
      export function func2() {}
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(2);
    expect(result.exports.has("func1")).toBe(true);
    expect(result.exports.has("func2")).toBe(true);
  });

  it("Const exports, object, empty", async () => {
    // --- Arrange
    const source = `
      export const {} = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(0);
  });

  it("Const exports, object, single ID", async () => {
    // --- Arrange
    const source = `
      export const {a} = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(1);
    expect(result.exports.has("a")).toBe(true);
  });

  it("Const exports, object, multiple IDs #1", async () => {
    // --- Arrange
    const source = `
      export const {a, b} = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(2);
    expect(result.exports.has("a")).toBe(true);
    expect(result.exports.has("b")).toBe(true);
  });

  it("Const exports, object, multiple IDs #2", async () => {
    // --- Arrange
    const source = `
      export const {a, b, } = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(2);
    expect(result.exports.has("a")).toBe(true);
    expect(result.exports.has("b")).toBe(true);
  });

  it("Const exports, object, single aliased ID", async () => {
    // --- Arrange
    const source = `
      export const {a: aA} = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(1);
    expect(result.exports.has("aA")).toBe(true);
  });

  it("Const exports, object, multiple aliased IDs #1", async () => {
    // --- Arrange
    const source = `
      export const {a: aA, b: bB} = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(2);
    expect(result.exports.has("aA")).toBe(true);
    expect(result.exports.has("bB")).toBe(true);
  });

  it("Const exports, object, multiple aliased IDs #2", async () => {
    // --- Arrange
    const source = `
      export const {a: aA, b: bB, } = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(2);
    expect(result.exports.has("aA")).toBe(true);
    expect(result.exports.has("bB")).toBe(true);
  });

  it("Const exports, object, single nested object #1", async () => {
    // --- Arrange
    const source = `
      export const {a: {b}} = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(1);
    expect(result.exports.has("b")).toBe(true);
  });

  it("Const exports, object, single nested object #2", async () => {
    // --- Arrange
    const source = `
      export const {a: {b, c: cC}} = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(2);
    expect(result.exports.has("b")).toBe(true);
    expect(result.exports.has("cC")).toBe(true);
  });

  it("Const exports, array, empty #1", async () => {
    // --- Arrange
    const source = `
      export const [] = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(0);
  });

  it("Const exports, array, empty #2", async () => {
    // --- Arrange
    const source = `
      export const [,] = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(0);
  });

  it("Const exports, array, single ID", async () => {
    // --- Arrange
    const source = `
      export const [a] = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(1);
    expect(result.exports.has("a")).toBe(true);
  });

  it("Const exports, array, multiple IDs #1", async () => {
    // --- Arrange
    const source = `
      export const [a, b] = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(2);
    expect(result.exports.has("a")).toBe(true);
    expect(result.exports.has("b")).toBe(true);
  });

  it("Const exports, array, multiple IDs #2", async () => {
    // --- Arrange
    const source = `
      export const [a, b, ] = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(2);
    expect(result.exports.has("a")).toBe(true);
    expect(result.exports.has("b")).toBe(true);
  });

  it("Const exports, array, multiple IDs #3", async () => {
    // --- Arrange
    const source = `
      export const [a,,, b, ] = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(2);
    expect(result.exports.has("a")).toBe(true);
    expect(result.exports.has("b")).toBe(true);
  });

  it("Const exports, array, single nested array #1", async () => {
    // --- Arrange
    const source = `
      export const [a, [b,c]] = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(3);
    expect(result.exports.has("a")).toBe(true);
    expect(result.exports.has("b")).toBe(true);
    expect(result.exports.has("c")).toBe(true);
  });

  it("Const exports, array, single nested array #2", async () => {
    // --- Arrange
    const source = `
      export const [[a,b], c] = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(3);
    expect(result.exports.has("a")).toBe(true);
    expect(result.exports.has("b")).toBe(true);
    expect(result.exports.has("c")).toBe(true);
  });

  it("Const exports, array in object #1", async () => {
    // --- Arrange
    const source = `
      export const {a, b: [,c]} = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(2);
    expect(result.exports.has("a")).toBe(true);
    expect(result.exports.has("c")).toBe(true);
  });

  it("Const exports, object in array #1", async () => {
    // --- Arrange
    const source = `
      export const [a, {b, c}] = expr;
    `;

    // --- Act
    const result = (await parseModule(source)) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);

    expect(result.exports.size).toBe(3);
    expect(result.exports.has("a")).toBe(true);
    expect(result.exports.has("b")).toBe(true);
    expect(result.exports.has("c")).toBe(true);
  });


  it("Parsing error", async () => {
    // --- Arrange
    const source = `const;`;

    // --- Act
    const result = await parseModule(source);

    // --- Assert
    expect(isModuleErrors(result)).toBe(true);
    const errors = result as ModuleErrors;
    expect(Object.keys(errors).length).toBe(1);
  });

  it("Duplicate export error #1", async () => {
    // --- Arrange
    const source = `
        export const a = 1;
        export const a = 2;
    `;

    // --- Act
    const result = await parseModule(source);

    // --- Assert
    expect(isModuleErrors(result)).toBe(true);
    const errors = result as ModuleErrors;
    expect(Object.keys(errors).length).toBe(1);
    expect(errors[ROOT_MODULE].length).toBe(1);
    expect(errors[ROOT_MODULE][0].code).toBe("K024");
    expect(errors[ROOT_MODULE][0].text).toContain("'a'");
  });

  it("Duplicate export error #2", async () => {
    // --- Arrange
    const source = `
        export const a = 1;
        export function a(){}
    `;

    // --- Act
    const result = await parseModule(source);

    // --- Assert
    expect(isModuleErrors(result)).toBe(true);
    const errors = result as ModuleErrors;
    expect(Object.keys(errors).length).toBe(1);
    expect(errors[ROOT_MODULE].length).toBe(1);
    expect(errors[ROOT_MODULE][0].code).toBe("K024");
    expect(errors[ROOT_MODULE][0].text).toContain("'a'");
  });

  it("Import module", async () => {
    // --- Arrange
    const source = `
    import { a } from "module1";
    `;

    const modules: Record<string, string> = {
      module1: `export const a = 1;`
    };

    // --- Act
    const result = await parseModule(source, modules) as KsxModule;

    // --- Assert
    expect(!isModuleErrors(result)).toBe(true);
    expect(result.name).toBe(ROOT_MODULE);
    expect(result.importedModules.length).toBe(1);
    expect(result.importedModules.some(mod => mod.name === "module1")).toBe(true);
  });
});

async function parseModule (
  source: string,
  modules: Record<string, string> = {}
) {
  return await parseKsxModule(
    ROOT_MODULE,
    source,
    async (moduleName: string) => modules[moduleName] ?? null
  );
}
