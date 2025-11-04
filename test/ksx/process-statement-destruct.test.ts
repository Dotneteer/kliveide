import { describe, it, expect } from "vitest";
import {
  CancellationToken,
  EvaluationContext,
  createEvalContext
} from "@common/ksx/EvaluationContext";
import { KsxModule, parseKsxModule, isModuleErrors, executeModule } from "@common/ksx/ksx-module";

const ROOT_MODULE = "test";

describe("KSX Execution - destructure", () => {
  it("expression statement #1", async () => {
    // --- Arrange
    const source = "let [a, b] = [3, 6]; x = a; y = b;";
    const localContext = {
      x: 0,
      y: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
  });

  it("let array destructure #2", async () => {
    // --- Arrange
    const source = "let [,a, b] = [3, 6, 8]; x = a; y = b;";
    const localContext = {
      x: 0,
      y: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(6);
    expect(evalContext.localContext.y).toBe(8);
  });

  it("let array destructure #3", async () => {
    // --- Arrange
    const source = "let [a, [b, c]] = [3, [6, 8]]; x = a; y = b; z = c;";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("let array destructure #4", async () => {
    // --- Arrange
    const source = "let [a, , [, b, c]] = [3, -11, [-1, 6, 8]]; x = a; y = b; z = c;";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("let object destructure #1", async () => {
    // --- Arrange
    const source = "let {a, b} = {a: 3, b: 6}; x = a; y = b;";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
  });

  it("let object destructure #2", async () => {
    // --- Arrange
    const source = "let {a, qqq:b } = {a: 3, qqq: 6}; x = a; y = b;";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
  });

  it("let object destructure #3", async () => {
    // --- Arrange
    const source = "let {a, qqq: {b, c}} = {a: 3, qqq: {b: 6, c: 8}}; x = a; y = b; z = c";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("let object and array destructure #1", async () => {
    // --- Arrange
    const source = "let {a, qqq: [b, c]} = {a: 3, qqq: [6, 8] }; x = a; y = b; z = c";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("let object and array destructure #2", async () => {
    // --- Arrange
    const source = "let {a, qqq: [b,,c]} = {a: 3, qqq: [6, -1, 8] }; x = a; y = b; z = c";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("let object and array destructure #3", async () => {
    // --- Arrange
    const source = "let [a, {b, c}] = [3, {b: 6, c: 8}]; x = a; y = b; z = c";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("let object and array destructure #4", async () => {
    // --- Arrange
    const source = "let [a, , {b, c}] = [3, -1, {b: 6, c: 8}]; x = a; y = b; z = c";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("const array destructure #1", async () => {
    // --- Arrange
    const source = "const [a, b] = [3, 6]; x = a; y = b;";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
  });

  it("const array destructure #2", async () => {
    // --- Arrange
    const source = "const [,a, b] = [3, 6, 8]; x = a; y = b;";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(6);
    expect(evalContext.localContext.y).toBe(8);
  });

  it("const array destructure #3", async () => {
    // --- Arrange
    const source = "const [a, [b, c]] = [3, [6, 8]]; x = a; y = b; z = c;";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("const array destructure #4", async () => {
    // --- Arrange
    const source = "const [a, , [, b, c]] = [3, -11, [-1, 6, 8]]; x = a; y = b; z = c;";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("const object destructure #1", async () => {
    // --- Arrange
    const source = "const {a, b} = {a: 3, b: 6}; x = a; y = b;";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
  });

  it("const object destructure #2", async () => {
    // --- Arrange
    const source = "const {a, qqq:b } = {a: 3, qqq: 6}; x = a; y = b;";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
  });

  it("const object destructure #3", async () => {
    // --- Arrange
    const source = "const {a, qqq: {b, c}} = {a: 3, qqq: {b: 6, c: 8}}; x = a; y = b; z = c";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("const object and array destructure #1", async () => {
    // --- Arrange
    const source = "const {a, qqq: [b, c]} = {a: 3, qqq: [6, 8] }; x = a; y = b; z = c";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("const object and array destructure #2", async () => {
    // --- Arrange
    const source = "const {a, qqq: [b,,c]} = {a: 3, qqq: [6, -1, 8] }; x = a; y = b; z = c";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("const object and array destructure #3", async () => {
    // --- Arrange
    const source = "const [a, {b, c}] = [3, {b: 6, c: 8}]; x = a; y = b; z = c";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("const object and array destructure #4", async () => {
    // --- Arrange
    const source = "const [a, , {b, c}] = [3, -1, {b: 6, c: 8}]; x = a; y = b; z = c";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("arrow destructure #1", async () => {
    // --- Arrange
    const source = "const fn = ([a, b]) => { x = a; y = b}; fn([3, 6, 8])";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
  });

  it("arrow destructure #2", async () => {
    // --- Arrange
    const source = "const fn = ([a, , b]) => { x = a; y = b}; fn([3, 6, 8])";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(8);
  });

  it("arrow destructure #3", async () => {
    // --- Arrange
    const source = "const fn = ([a, b]) => { x = a; y = b}; fn([3])";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(undefined);
  });

  it("arrow destructure #4", async () => {
    // --- Arrange
    const source = "const fn = ([a, , b]) => { x = a; y = b}; fn([3, 6])";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(undefined);
  });

  it("arrow destructure #5", async () => {
    // --- Arrange
    const source = "const fn = ([a, [b, c]]) => { x = a; y = b; z = c }; fn([3, [6, 8]])";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("arrow destructure #6", async () => {
    // --- Arrange
    const source = "const fn = ({a, b}) => { x = a; y = b}; fn({a: 3, b: 6, v: 8})";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
  });

  it("arrow destructure #7", async () => {
    // --- Arrange
    const source = "const fn = ({a, b}) => { x = a; y = b}; fn({a: 3, v: 8})";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(undefined);
  });

  it("arrow destructure #8", async () => {
    // --- Arrange
    const source = "const fn = ({a, q:b}) => { x = a; y = b}; fn({a: 3, q: 6, v: 8})";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
  });

  it("arrow destructure #9", async () => {
    // --- Arrange
    const source =
      "const fn = ({a, q: {b, c}}) => { x = a; y = b; z = c}; fn({a: 3, q: {b: 6, c: 8}})";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("arrow destructure #10", async () => {
    // --- Arrange
    const source = "const fn = ({a, q:[b, c]}) => { x = a; y = b; z = c}; fn({a: 3, q: [6, 8]})";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("arrow destructure #11", async () => {
    // --- Arrange
    const source =
      "const fn = ({a, q:[b, , c]}) => { x = a; y = b; z = c}; fn({a: 3, q: [6, -1, 8]})";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });

  it("arrow destructure #12", async () => {
    // --- Arrange
    const source = "const fn = ([a, {b, c}]) => { x = a; y = b; z = c}; fn([3, {b: 6, c: 8}])";
    const localContext = {
      x: 0,
      y: 0,
      z: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.y).toBe(6);
    expect(evalContext.localContext.z).toBe(8);
  });
});

async function execModule(
  source: string,
  localContext: Record<string, any> = {},
  cancellationToken?: CancellationToken
): Promise<{ evalContext: EvaluationContext; parsedModule: KsxModule }> {
  const parsedModule = await parseKsxModule(
    ROOT_MODULE,
    source,
    async (moduleName: string) => null
  );

  if (isModuleErrors(parsedModule)) {
    throw new Error("Module parsing error");
  }

  const evalContext = createEvalContext({
    cancellationToken,
    localContext
  });

  await executeModule(parsedModule, evalContext);
  return { evalContext, parsedModule };
}
