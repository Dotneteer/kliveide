import "mocha";
import { expect } from "expect";
import assert from "assert";
import {
  CancellationToken,
  EvaluationContext,
  createEvalContext
} from "@common/ksx/EvaluationContext";
import {
  KsxModule,
  parseKsxModule,
  isModuleErrors,
  executeModule
} from "@common/ksx/ksx-module";
import { Expression } from "@common/ksx/source-tree";
import { Parser } from "@common/ksx/Parser";

const ROOT_MODULE = "test";

describe("KSX Execution - regression", () => {
  it("while with break #2", async () => {
    // --- Arrange
    const source = "let x = 0; while (true) {x++ ; if (x > 3) break;}; x++";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread;
    expect(thread!.blocks!.length).toBe(1);
    expect(thread!.blocks![0].vars.x).toBe(5);
  });

  it("regression #2", async () => {
    // --- Arrange
    const source = "((maybeUndefined)=> maybeUndefined)()";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
  });

  it("recursive arrow regression #1", async () => {
    // --- Arrange
    const source =
      "const fact = n => { if (n === 0) return 1; else return n * fact(n-1); }; x = fact(3)";
    const startContext = createEvalContext({
      localContext: {}
    });
    startContext.mainThread!.blocks = [
      {
        vars: {
          x: 0
        }
      }
    ];

    // --- Act
    const { evalContext } = await execModuleWithContext(source, startContext);

    // --- Assert
    const thread = evalContext.mainThread;
    expect(thread!.blocks!.length).toBe(1);
    expect(thread!.blocks![0].vars.x).toBe(6);
  });

  it("mapped arrow regression #1", async () => {
    // --- Arrange
    const source =
      "const mapped = [1,2,3].map(id => {return {id: id} }); console.log(mapped)";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread;
    expect(thread!.blocks!.length).toBe(1);
    expect(thread!.blocks![0].vars.mapped.length).toBe(3);
  });

  it("arrow with vars sub-property regression #1", async () => {
    // --- Arrange
    const source = "let arrow = (val) => val.value++; arrow(x)";
    const startContext = createEvalContext({
      localContext: {}
    });
    startContext.mainThread!.blocks = [
      {
        vars: {
          x: { value: 0 }
        }
      }
    ];

    // --- Act
    const { evalContext } = await execModuleWithContext(source, startContext);

    // --- Assert
    const thread = evalContext.mainThread;
    expect(thread!.blocks!.length).toBe(1);
    expect(thread!.blocks![0].vars.x.value).toBe(1);
  });

  it("arrow with vars sub-property regression #2", async () => {
    // --- Arrange
    const source = "let arrow = (val) => val.some++; arrow(x.value)";
    const startContext = createEvalContext({
      localContext: {}
    });
    startContext.mainThread!.blocks = [
      {
        vars: {
          x: {
            value: { some: 0 }
          }
        }
      }
    ];

    // --- Act
    const { evalContext } = await execModuleWithContext(source, startContext);

    // --- Assert
    const thread = evalContext.mainThread;
    expect(thread!.blocks!.length).toBe(1);
    expect(thread!.blocks![0].vars.x.value.some).toBe(1);
  });

  it("Arrow argument reference indirection", async () => {
    // --- Arrange
    const source = "incrementFunc(counter.value)";
    const startContext = createEvalContext({
      localContext: {}
    });
    startContext.mainThread!.blocks = [
      {
        vars: {
          counter: {
            value: { some: 0 }
          },
          incrementFunc: {
            ...parseExpression("x => x.some++"),
            _ARROW_EXPR_: true
          }
        }
      }
    ];

    // --- Act
    const { evalContext } = await execModuleWithContext(source, startContext);

    // --- Assert
    const thread = evalContext.mainThread;
    expect(thread!.blocks!.length).toBe(1);
    expect(thread!.blocks![0].vars.counter.value.some).toBe(1);
  });

  it("delete #1", async () => {
    // --- Arrange
    const source = "x = delete alma";

    const localContext = {
      x: 0,
      alma: {}
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(true);
    expect(evalContext.localContext.alma).toBe(undefined);
  });

  it("delete #2", async () => {
    // --- Arrange
    const source = "x = delete alma.b";
    const localContext = {
      x: 0,
      alma: { a: "hello", b: "hi" }
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(true);
    expect(evalContext.localContext.alma.b).toBe(undefined);
    expect(evalContext.localContext.alma.a).toBe("hello");
  });

  it("delete #3", async () => {
    // --- Arrange
    const source = "x = delete alma[1]";
    const localContext = {
      x: 0,
      alma: [1, 2, 3]
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe(true);
    expect(evalContext.localContext.alma.length).toBe(3);
    expect(evalContext.localContext.alma[0]).toBe(1);
    expect(evalContext.localContext.alma[1]).toBe(undefined);
    expect(evalContext.localContext.alma[2]).toBe(3);
  });

  it("delete #4", async () => {
    // --- Arrange
    const source = "x = delete Math.PI";
    const localContext = {
      x: 123
    };

    // --- Act/Assert
    try {
      await execModule(source, localContext);
    } catch (err) {
      expect(err instanceof TypeError).toBe(true);
      return;
    }
    assert.fail("Exception expected");
  });

  it("disallow running banned function #1", async () => {
    // --- Arrange
    const source = "const x = setTimeout(() => {}, 300)";
    const localContext = {};

    // --- Act/Assert
    try {
      await execModule(source, localContext);
    } catch (err) {
      expect(err.toString().includes("not allowed to call")).toBe(true);
      return;
    }
    assert.fail("Exception expected");
  });

  it("Arrow function arg regression (async) #1", async () => {
    // --- Arrange
    const source = "val = [0,1,2,3].filter(k => k === 2 || k === 3);";
    const localContext = { val: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.val).toStrictEqual([2, 3]);
  });

  it("Closure regression #1", async () => {
    // --- Arrange
    const source = `
      const func = ()=> {
        const dummy = 'dummy';

        return {
          fireListMessages: () => {
             x = dummy;
          }
        };
      }
      func().fireListMessages();
      `;
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe("dummy");
  });

  it("Closure regression #2", async () => {
    // --- Arrange
    const source = `
      const func = ()=> {
        const fireListMessages = () => {
          x = dummy;
        }

        const dummy = 'dummy';

        return {
          fireListMessages
        };
      }
      func().fireListMessages();
      `;
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe("dummy");
  });

  it("Closure regression #3", async () => {
    // --- Arrange
    const source = `
      const func = ()=> {
        const fireListMessages = () => {
          const otherDummy = "hey!"
          return {
            nested: () => {
              x = otherDummy;
            }
          }
        }

        const dummy = 'dummy';

        return {
          fireListMessages
        };
      }
      func().fireListMessages().nested();
      `;
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.localContext.x).toBe("hey!");
  });
});

async function execModule (
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

async function execModuleWithContext (
  source: string,
  evalContext: EvaluationContext
): Promise<{ evalContext: EvaluationContext; parsedModule: KsxModule }> {
  const parsedModule = await parseKsxModule(
    ROOT_MODULE,
    source,
    async (moduleName: string) => null
  );

  if (isModuleErrors(parsedModule)) {
    throw new Error("Module parsing error");
  }

  await executeModule(parsedModule, evalContext);
  return { evalContext, parsedModule };
}

export function parseExpression (source: string): Expression {
  const wParser = new Parser(source);
  const tree = wParser.parseExpr();
  if (tree === null) {
    // --- This should happen only there were errors during the parse phase
    throw new Error("Source code parsing failed");
  }
  return tree;
}
