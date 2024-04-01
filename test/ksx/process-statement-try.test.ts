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

const ROOT_MODULE = "test";

describe("KSX Execution - try", () => {
  it("throw", async () => {
    // --- Arrange
    const source = `
          throw { type: 'Error' }
        `;
    const localContext = {
      x: 1
    };

    // --- Act
    try {
      await execModule(source, localContext);
    } catch (err) {
      expect(err.errorObject.type).toBe("Error");
      return;
    }
    assert.fail("Exception expected");
  });

  it("throw a given Error object", async () => {
    // --- Arrange
    const source = `
            throw errObj
          `;
    const localContext = {
      x: 1,
      errObj: new Error("Hello, Error!")
    };

    // --- Act
    try {
      await execModule(source, localContext);
    } catch (err) {
      expect(err.message.toString()).toBe("Hello, Error!");
      return;
    }
    assert.fail("Exception expected");
  });

  it("try - catch, normal", async () => {
    // --- Arrange
    const source = `
            try {
              x = 2
            } catch {
            }
          `;
    const localContext = {
      x: 1
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(2);
  });

  it("try - finally, normal", async () => {
    // --- Arrange
    const source = `
            try {
              x = 2
            } finally {
              x = 3
            }
          `;
    const localContext = {
      x: 1
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
  });

  it("try - catch nested, normal", async () => {
    // --- Arrange
    const source = `
            try {
              try {
                x = 2
              } finally {
                x = 3
              }
            } catch {
          }
          `;
    const localContext = {
      x: 1
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
  });

  it("try - finally nested, normal", async () => {
    // --- Arrange
    const source = `
            try {
              try {
                x = 2
              } finally {
                x = 3
              }
            } finally {
              x = 4
          }
          `;
    const localContext = {
      x: 1
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(4);
  });

  it("try - finally with break", async () => {
    // --- Arrange
    const source = `
            while (true) {
              try {
                break;
                x = -4;
              } finally {
                x = 3
              }
            }
          `;
    const localContext = {
      x: 1
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
  });

  it("try - finally nested with break", async () => {
    // --- Arrange
    const source = `
            while (true) {
              try {
                try {
                  break;
                  x = -4;
                } finally {
                  x = 3
                }
              } finally {
                x = 4
              }
            }
          `;
    const localContext = {
      x: 1
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(4);
  });

  it("try - finally with continue", async () => {
    // --- Arrange
    const source = `
            while (x < 3) {
              try {
                z++;
                if (x === 1) continue;
                z++;
              } finally {
                x++
              }
            }
          `;
    const localContext = {
      z: 0,
      x: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.z).toBe(5);
  });

  it("try - finally nested with continue", async () => {
    // --- Arrange
    const source = `
            while (x < 3) {
              try {
                try {
                  z++;
                  if (x === 1) continue;
                  z++;
                } finally {
                  x++
                }
              } finally {
                z += 100
              }
            }
          `;
    const localContext = {
      z: 0,
      x: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
    expect(evalContext.localContext.z).toBe(305);
  });

  it("try - finally with return #1", async () => {
    // --- Arrange
    const source = `
            try {
              return 123;
            } finally {
              x = 1
            }
          `;
    const localContext = {
      z: 0,
      x: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(1);
  });

  it("try - finally nested with return", async () => {
    // --- Arrange
    const source = `
            try {
              try {
                return 123;
              } finally {
                x++
              }
            } finally {
              x++
            }
          `;
    const localContext = {
      z: 0,
      x: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(2);
  });

  it("try - finally, error", async () => {
    // --- Arrange
    const source = `
            try {
              x = 2;
              throw { type: 'Error' }
            } finally {
              x++
            }
          `;
    const evalContext = createEvalContext({
      localContext: {
        x: 1
      }
    });

    // --- Act
    try {
      await execModuleWithContext(source, evalContext);
    } catch (err) {
      // --- Assert
      expect(evalContext.mainThread!.blocks!.length).toBe(1);
      expect(evalContext.localContext.x).toBe(3);
      expect(err.errorObject.type).toBe("Error");
      return;
    }
    assert.fail("Exception expected");
  });

  it("try - finally nested, error", async () => {
    // --- Arrange
    const source = `
            try {
              try {
                x = 2;
                throw { type: 'Error' }
              } finally {
                x++
              }
            } finally {
              x++
            }
          `;
    const evalContext = createEvalContext({
      localContext: {
        x: 1
      }
    });

    // --- Act
    try {
      await execModuleWithContext(source, evalContext);
    } catch (err) {
      // --- Assert
      expect(evalContext.mainThread!.blocks!.length).toBe(1);
      expect(evalContext.localContext.x).toBe(4);
      expect(err.errorObject.type).toBe("Error");
      return;
    }
    assert.fail("Exception expected");
  });

  it("try - catch, error", async () => {
    // --- Arrange
    const source = `
            try {
              x = 2;
              throw { type: 'Error' }
            } catch {
              x++
            }
          `;
    const localContext = {
      x: 1
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
  });

  it("try - catch - finally, error", async () => {
    // --- Arrange
    const source = `
            try {
              x = 2;
              throw { type: 'Error' }
            } catch {
              x++
            } finally {
              x++
            }
          `;
    const localContext = {
      x: 1
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(4);
    return;
  });

  it("try - catch, error rethrown", async () => {
    // --- Arrange
    const source = `
            try {
              x = 2;
              throw { type: 'Error' }
            } catch (err) {
              x++;
              throw err
            }
          `;
    const evalContext = createEvalContext({
      localContext: {
        x: 1
      }
    });

    // --- Act
    try {
      await execModuleWithContext(source, evalContext);
    } catch (err) {
      // --- Assert
      expect(evalContext.mainThread!.blocks!.length).toBe(1);
      expect(evalContext.localContext.x).toBe(3);
      expect(err.errorObject.type).toBe("Error");
      return;
    }
    assert.fail("Exception expected");
  });

  it("try - catch, error rethrown, finally", async () => {
    // --- Arrange
    const source = `
            try {
              x = 2;
              throw { type: 'Error' }
            } catch (err) {
              x++;
              throw err
            } finally {
              x++
            }
          `;
    const evalContext = createEvalContext({
      localContext: {
        x: 1
      }
    });

    // --- Act
    try {
      await execModuleWithContext(source, evalContext);
    } catch (err) {
      // --- Assert
      expect(evalContext.mainThread!.blocks!.length).toBe(1);
      expect(evalContext.localContext.x).toBe(4);
      expect(err.errorObject.type).toBe("Error");
      return;
    }
    assert.fail("Exception expected");
  });

  it("try - catch, error rethrown other", async () => {
    // --- Arrange
    const source = `
            try {
              x = 2;
              throw { type: 'Error' }
            } catch (err) {
              x++;
              throw { type: "Other" }
            }
          `;
    const evalContext = createEvalContext({
      localContext: {
        x: 1
      }
    });

    // --- Act
    try {
      await execModuleWithContext(source, evalContext);
    } catch (err) {
      // --- Assert
      expect(evalContext.mainThread!.blocks!.length).toBe(1);
      expect(evalContext.localContext.x).toBe(3);
      expect(err.errorObject.type).toBe("Other");
      return;
    }
    assert.fail("Exception expected");
  });

  it("try - catch, error rethrown other, finally", async () => {
    // --- Arrange
    const source = `
            try {
              x = 2;
              throw { type: 'Error' }
            } catch (err) {
              x++;
              throw { type: "Other" }
            } finally {
              x++
            }
          `;
    const evalContext = createEvalContext({
      localContext: {
        x: 1
      }
    });

    // --- Act
    try {
      await execModuleWithContext(source, evalContext);
    } catch (err) {
      // --- Assert
      expect(evalContext.mainThread!.blocks!.length).toBe(1);
      expect(evalContext.localContext.x).toBe(4);
      expect(err.errorObject.type).toBe("Other");
      return;
    }
    assert.fail("Exception expected");
  });

  it("try - catch - finally, error in finally", async () => {
    // --- Arrange
    const source = `
            try {
              x = 2;
              throw { type: 'Error' }
            } catch {
              x++
            } finally {
              x++;
              throw { type: "finallyError" }
            }
          `;
    const evalContext = createEvalContext({
      localContext: {
        x: 1
      }
    });

    // --- Act
    try {
      await execModuleWithContext(source, evalContext);
    } catch (err) {
      // --- Assert
      expect(evalContext.mainThread!.blocks!.length).toBe(1);
      expect(evalContext.localContext.x).toBe(4);
      expect(err.errorObject.type).toBe("finallyError");
      return;
    }
    assert.fail("Exception expected");
  });

  it("try - catch with return", async () => {
    // --- Arrange
    const source = `
            try {
              throw { type: "Error" }
            } catch {
              x = 1;
              return 123;
            }
          `;
    const localContext = {
      x: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread.returnValue).toBe(123);
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(1);
  });

  it("try - finally with return #2", async () => {
    // --- Arrange
    const source = `
            try {
              throw { type: "Error" }
            } finally {
              x = 1;
              return 123;
            }
          `;
    const evalContext = createEvalContext({
      localContext: {
        x: 0
      }
    });

    // --- Act
    try {
      await execModuleWithContext(source, evalContext);
    } catch (err) {
      // --- Assert
      console.log(err);
      expect(evalContext.mainThread.returnValue).toBe(123);
      expect(evalContext.mainThread!.blocks!.length).toBe(1);
      expect(evalContext.localContext.x).toBe(1);
      expect(err.errorObject.type).toBe("Error");
      return;
    }
    assert.fail("Exception expected");
  });

  it("try - finally with second return", async () => {
    // --- Arrange
    const source = `
            try {
              return 234
            } finally {
              x = 1;
              return 123;
            }
          `;
    const localContext = {
      x: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread.returnValue).toBe(123);
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(1);
  });

  it("try - catch, finally with second return", async () => {
    // --- Arrange
    const source = `
            try {
              throw { type: "Error" }
            } catch {
              return 234;
            } finally {
              x = 1;
              return 123;
            }
          `;
    const localContext = {
      x: 0
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread.returnValue).toBe(123);
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(1);
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
