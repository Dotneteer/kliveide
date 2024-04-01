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

describe("KSX Execution - statements", () => {
  it("expression statement #1", async () => {
    // --- Arrange
    const source = "x = 3 * x;";
    const localContext = { x: 1 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
  });

  it("Let statement #1", async () => {
    // --- Arrange
    const source = "let y";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect("y" in thread.blocks![0].vars).toBe(true);
    expect(thread.blocks![0].constVars.has("y")).toBe(false);
  });

  it("Let statement #2", async () => {
    // --- Arrange
    const source = "let y = 3";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(3);
    expect(thread.blocks![0].constVars.has("y")).toBe(false);
  });

  it("Let statement #3", async () => {
    // --- Arrange
    const source = "let y = 3, z = 2";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(3);
    expect(thread.blocks![0].vars.z).toBe(2);
    expect(thread.blocks![0].constVars.has("y")).toBe(false);
    expect(thread.blocks![0].constVars.has("z")).toBe(false);
  });

  it("Const statement #2", async () => {
    // --- Arrange
    const source = "const y = 3";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(3);
    expect(thread.blocks![0].constVars!.has("y")).toBe(true);
  });

  it("Const write #1", async () => {
    // --- Arrange
    const source = "const y = 3; y++";
    const localContext = { x: 0 };

    // --- Act
    try {
      await execModule(source, localContext);
    } catch (err) {
      return;
    }
    assert.fail("Exception expected");
  });

  it("Const write #2", async () => {
    // --- Arrange
    const source = "const y = 3; y = 12";
    const localContext = { x: 0 };

    // --- Act
    try {
      await execModule(source, localContext);
    } catch (err) {
      return;
    }
    assert.fail("Exception expected");
  });

  it("Implicit block #1", async () => {
    // --- Arrange
    const source = "let y = 3; x = 3 * y;";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(3);
    expect(evalContext.localContext.x).toBe(9);
  });

  it("Implicit block #2", async () => {
    // --- Arrange
    const source = "let y = 3; { let z = 2 ; x = 3 * y + z; }";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(3);
    expect(evalContext.localContext.x).toBe(11);
  });

  it("Block statement #1", async () => {
    // --- Arrange
    const source = "{ let y = 3; x = 3 * y; }";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(9);
  });

  it("Block statement #2", async () => {
    // --- Arrange
    const source = "{ let y = 3; { let z = 2 ; x = 3 * y + z; } }";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(11);
  });

  it("Block statement #3", async () => {
    // --- Arrange
    const source = "{ let y = 3; { let z = 2 ; { x = 3 * y + z; } } }";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(11);
  });

  it("Block statement #4", async () => {
    // --- Arrange
    const source =
      "{ let y = 3; { let z = 2 ; { let z = 3; x = 3 * y + z; } } }";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(12);
  });

  it("If statement #1", async () => {
    // --- Arrange
    const source = "if (x === 0) x = 3";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
  });

  it("If statement #2", async () => {
    // --- Arrange
    const source = "if (x === 0) {x = 3}";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
  });

  it("If statement #3", async () => {
    // --- Arrange
    const source = "if (x === 0) x = 3; else x = 2";
    const localContext = { x: 1 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(2);
  });

  it("If statement #4", async () => {
    // --- Arrange
    const source = "if (x === 0) x = 3; else { x = 2 }";
    const localContext = { x: 1 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(2);
  });

  it("If statement #5", async () => {
    // --- Arrange
    const source = "if (x === 0) {x = 3;} else { x = 2 }";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
  });

  it("If statement #6", async () => {
    // --- Arrange
    const source = "if (x === 0) {x = 3;} else { x = 2 }";
    const localContext = { x: 1 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(2);
  });

  it("while statement #1", async () => {
    // --- Arrange
    const source = "while (x < 3) x++;";
    const localContext = { x: 1 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
  });

  it("while statement #2", async () => {
    // --- Arrange
    const source = "let x = 0; while (x < 3) x++;";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.x).toBe(3);
  });

  it("while statement #3", async () => {
    // --- Arrange
    const source = "let x = 0; while (x < 8) {let y = 2; x += y;}";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.x).toBe(8);
  });

  it("while statement #4", async () => {
    // --- Arrange
    const source =
      "let x = 0; while (x < 18) {let y = 0; while (y < 3) {x += y; y++;} }";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.x).toBe(18);
  });

  it("while with break #1", async () => {
    // --- Arrange
    const source = "let x = 0; while (true) {x++ ; if (x > 3) break;}";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.x).toBe(4);
  });

  it("while with break #2", async () => {
    // --- Arrange
    const source = "let x = 0; while (true) {x++ ; if (x > 3) break;}; x++";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.x).toBe(5);
  });

  it("while with continue #1", async () => {
    // --- Arrange
    const source =
      "let y = 0; let x = 0; while (x < 6) {x++; if (x == 3) continue; y += x; }";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(18);
  });

  it("do-while statement #1", async () => {
    // --- Arrange
    const source = "do x++; while (x < 3)";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
  });

  it("do-while statement #2", async () => {
    // --- Arrange
    const source = "do x++; while (x < 0)";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(1);
  });

  it("do-while statement #3", async () => {
    // --- Arrange
    const source = "do { x++;} while (x < 3)";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    expect(evalContext.mainThread!.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(3);
  });

  it("do-while statement #4", async () => {
    // --- Arrange
    const source = "let x = 0; do {let y = 2; x += y;} while (x < 8) ";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.x).toBe(8);
  });

  it("do-while statement #5", async () => {
    // --- Arrange
    const source =
      "let x = 0; do {let y = 0; while (y < 3) {x += y; y++;} } while (x < 18)";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.x).toBe(18);
  });

  it("do-while with break #1", async () => {
    // --- Arrange
    const source = "let x = 0; do {x++ ; if (x > 3) break;} while (true)";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.x).toBe(4);
  });

  it("do-while with continue #1", async () => {
    // --- Arrange
    const source =
      "let y = 0; let x = 0; do {x++; if (x == 3) continue; y += x; } while (x < 6)";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(18);
  });

  it("for-loop #1", async () => {
    // --- Arrange
    const source = "let y = 0; for (let i = 0; i < 4; i++) y += i;";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(6);
  });

  it("for-loop #2", async () => {
    // --- Arrange
    const source = "let y = 0; for (let i = 0; i < 4; i++) {y += i;}";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(6);
  });

  it("for-loop #3", async () => {
    // --- Arrange
    const source = "let y = 0; for (let i = 0; i < 4; i++) {y += i;}; y++";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(7);
  });

  it("for-loop #4", async () => {
    // --- Arrange
    const source =
      "let y = 0; for (let i = 0, j = 0; i < 4; i++, j+=2) {y += i + j}";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(18);
  });

  it("for-loop #5", async () => {
    // --- Arrange
    const source = "let y = 0; let i = 0; for (; i < 4; i++) {y += i}";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(6);
  });

  it("for-loop with continue", async () => {
    // --- Arrange
    const source =
      "let y = 0; for (let i = 0; i < 10; i++) {if (i % 3 === 0) continue; y += i; }";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(27);
  });

  it("for-loop #6", async () => {
    // --- Arrange
    const source = "let y = 0; for (let i = 0; i < 4; i++) { break; }; y++";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.y).toBe(1);
  });

  it("Arrow function body #1", async () => {
    // --- Arrange
    const source = "(() => {return 2})()";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].returnValue).toBe(2);
  });

  it("Arrow function body #2", async () => {
    // --- Arrange
    const source = "let arr = () => {return 2}; let x = arr();";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.x).toBe(2);
  });

  it("Arrow function body #3", async () => {
    // --- Arrange
    const source =
      "let arr = (x, y) => { let sum = 0; for (let i = x; i <= y; i++) sum+= i; return sum }; arr(1, 5);";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].returnValue).toBe(15);
  });

  it("Arrow function body #4", async () => {
    // --- Arrange
    const source =
      "let arr = (x, y) => { let sum = 0; for (let i = x; i <= y; i++) sum+= i; return sum }; z = arr(1, 5);";
    const localContext = { z: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(evalContext.localContext.z).toBe(15);
    expect(thread.blocks![0].returnValue).toBe(15);
  });

  it("return #1", async () => {
    // --- Arrange
    const source = "return 123";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe(123);
  });

  it("return #2", async () => {
    // --- Arrange
    const source = "x = 1; return 123; x = 2";
    const localContext = { x: 0 };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(evalContext.localContext.x).toBe(1);
    expect(thread.returnValue).toBe(123);
  });

  it("return #3", async () => {
    // --- Arrange
    const source = "return";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe(undefined);
  });

  it("Assign to unknown object property", async () => {
    // --- Arrange
    const source = "const obj = {}; obj.someValue = 42;";
    const localContext = {};

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.blocks![0].vars.obj).toStrictEqual({ someValue: 42 });
    expect(thread.blocks![0].constVars!.has("obj")).toBe(true);
  });

  it("for..in loop with 'none' var binding - null", async () => {
    // --- Arrange
    const source =
      "let y; let res =''; for (y in obj) res += obj[y]; return res";
    const localContext = { obj: null as any };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("");
  });

  it("for..in loop with 'none' var binding - undefined", async () => {
    // --- Arrange
    const source =
      "let y; let res =''; for (y in obj) res += obj[y]; return res";
    const localContext = { obj: null as any };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("");
  });

  it("for..in loop with 'none' var binding", async () => {
    // --- Arrange
    const source =
      "let y; let res =''; for (y in obj) res += obj[y]; return res";
    const localContext = {
      obj: { one: "1", two: 2, three: 3 }
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("123");
  });

  it("for..in loop with 'none' var binding - break", async () => {
    // --- Arrange
    const source = `
        let y;
        let res ='';
        for (y in obj) {
          if (y === 'two') break;
          res += obj[y];
        }
        return res;`;
    const localContext = {
      obj: { one: "1", two: 2, three: 3 }
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("1");
  });

  it("for..in loop with 'none' var binding - continue", async () => {
    // --- Arrange
    const source = `
        let y;
        let res ='';
        for (y in obj) {
          if (y === 'two') continue;
          res += obj[y];
        }
        return res;`;
    const localContext = {
      obj: { one: "1", two: 2, three: 3 }
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("13");
  });

  it("for..in loop with 'let' var binding - null", async () => {
    // --- Arrange
    const source = "let res =''; for (let y in obj) res += obj[y]; return res";
    const localContext = {
      obj: null as any
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("");
  });

  it("for..in loop with 'let' var binding - undefined", async () => {
    // --- Arrange
    const source = "let res =''; for (let y in obj) res += obj[y]; return res";
    const localContext = {
      obj: null as any
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("");
  });

  it("for..in loop with 'let' var binding", async () => {
    // --- Arrange
    const source = "let res =''; for (let y in obj) res += obj[y]; return res";
    const localContext = {
      obj: { one: "1", two: 2, three: 3 }
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("123");
  });

  it("for..in loop with 'let' var binding - break", async () => {
    // --- Arrange
    const source = `
        let res ='';
        for (let y in obj) {
          if (y === 'two') break;
          res += obj[y];
        }
        return res;`;
    const localContext = {
      obj: { one: "1", two: 2, three: 3 }
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("1");
  });

  it("for..in loop with 'let' var binding - continue", async () => {
    // --- Arrange
    const source = `
        let res ='';
        for (let y in obj) {
          if (y === 'two') continue;
          res += obj[y];
        }
        return res;`;
    const localContext = {
      obj: { one: "1", two: 2, three: 3 }
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("13");
  });

  it("for..in loop with 'let' can write binding ", async () => {
    // --- Arrange
    const source = `
      let res ='';
      for (let y in obj) {
        res += obj[y];
        y = 345;
      }
      return res`;
    const localContext = {
      obj: { one: "1", two: 2, three: 3 }
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("123");
  });

  it("for..in loop with 'const' var binding - null", async () => {
    // --- Arrange
    const source =
      "let res =''; for (const y in obj) res += obj[y]; return res";
    const localContext = {
      obj: null as any
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("");
  });

  it("for..in loop with 'const' var binding - undefined", async () => {
    // --- Arrange
    const source =
      "let res =''; for (const y in obj) res += obj[y]; return res";
    const localContext = {
      obj: null as any
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("");
  });

  it("for..in loop with 'const' var binding", async () => {
    // --- Arrange
    const source =
      "let res =''; for (const y in obj) res += obj[y]; return res";
    const localContext = {
      obj: { one: "1", two: 2, three: 3 }
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("123");
  });

  it("for..in loop with 'const' var binding - break", async () => {
    // --- Arrange
    const source = `
        let res ='';
        for (const y in obj) {
          if (y === 'two') break;
          res += obj[y];
        }
        return res;`;
    const localContext = {
      obj: { one: "1", two: 2, three: 3 }
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("1");
  });

  it("for..in loop with 'const' var binding - continue", async () => {
    // --- Arrange
    const source = `
        let res ='';
        for (const y in obj) {
          if (y === 'two') continue;
          res += obj[y];
        }
        return res;`;
    const localContext = {
      obj: { one: "1", two: 2, three: 3 }
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("13");
  });

  it("for..in loop with 'const' disallows write binding ", async () => {
    // --- Arrange
    const source = `
      let res ='';
      for (const y in obj) {
        res += obj[y];
        y = 345;
      }
      return res`;
    const localContext = {
      obj: { one: "1", two: 2, three: 3 }
    };

    // --- Act/Assert
    try {
      await execModule(source, localContext);
    } catch (err) {
      expect(err.toString().includes("const")).toBe(true);
      return;
    }
    assert.fail("Exception expected");
  });

  it("for..of loop with not iterable #1", async () => {
    // --- Arrange
    const source = "for (y of obj) res += obj[y]; return res";
    const localContext = {
      obj: null as any
    };

    // --- Act/Assert
    try {
      await execModule(source, localContext);
    } catch (err) {
      expect(err.toString().includes("Iterator expected"));
      return;
    }
    assert.fail("Exception expected");
  });

  it("for..of loop with not iterable #2", async () => {
    // --- Arrange
    const source = "for (y of obj) res += obj[y]; return res";
    const localContext = {
      obj: 123
    };

    // --- Act/Assert
    try {
      await execModule(source, localContext);
    } catch (err) {
      expect(err.toString().includes("Iterator expected"));
      return;
    }
    assert.fail("Exception expected");
  });

  it("for..of loop with 'none' var binding", async () => {
    // --- Arrange
    const source = "let y; let res =''; for (y of obj) res += y; return res";
    const localContext = {
      obj: [1, 2, 3]
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("123");
  });

  it("for..of loop with 'none' var binding - break", async () => {
    // --- Arrange
    const source = `
        let y;
        let res ='';
        for (y of obj) {
          if (y === 2) break;
          res += y;
        }
        return res;`;
    const localContext = {
      obj: [1, 2, 3]
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("1");
  });

  it("for..of loop with 'none' var binding - continue", async () => {
    // --- Arrange
    const source = `
        let y;
        let res ='';
        for (y of obj) {
          if (y === 2) continue;
          res += y;
        }
        return res;`;
    const localContext = {
      obj: [1, 2, 3]
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("13");
  });

  it("for..of loop with 'let' var binding", async () => {
    // --- Arrange
    const source = "let res =''; for (let y of obj) res += y; return res";
    const localContext = {
      obj: [1, 2, 3]
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("123");
  });

  it("for..of loop with 'let' var binding - break", async () => {
    // --- Arrange
    const source = `
        let res ='';
        for (let y of obj) {
          if (y === 2) break;
          res += y;
        }
        return res;`;
    const localContext = {
      obj: [1, 2, 3]
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("1");
  });

  it("for..of loop with 'let' var binding - continue", async () => {
    // --- Arrange
    const source = `
        let res ='';
        for (let y of obj) {
          if (y === 2) continue;
          res += y;
        }
        return res;`;
    const localContext = {
      obj: [1, 2, 3]
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("13");
  });

  it("for..of loop with 'let' can write binding ", async () => {
    // --- Arrange
    const source = `
      let res ='';
      for (let y of obj) {
        res += y;
        y = 345;
      }
      return res`;
    const localContext = {
      obj: [1, 2, 3]
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("123");
  });

  it("for..of loop with 'const' var binding", async () => {
    // --- Arrange
    const source = "let res =''; for (const y of obj) res += y; return res";
    const localContext = {
      obj: [1, 2, 3]
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("123");
  });

  it("for..of loop with 'const' var binding - break", async () => {
    // --- Arrange
    const source = `
        let res ='';
        for (const y of obj) {
          if (y === 2) break;
          res += y;
        }
        return res;`;
    const localContext = {
      obj: [1, 2, 3]
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("1");
  });

  it("for..of loop with 'const' var binding - continue", async () => {
    // --- Arrange
    const source = `
        let res ='';
        for (const y of obj) {
          if (y === 2) continue;
          res += y;
        }
        return res;`;
    const localContext = {
      obj: [1, 2, 3]
    };

    // --- Act
    const { evalContext } = await execModule(source, localContext);

    // --- Assert
    const thread = evalContext.mainThread!;
    expect(thread.blocks!.length).toBe(1);
    expect(thread.returnValue).toBe("13");
  });

  it("for..of loop with 'const' disallows write binding ", async () => {
    // --- Arrange
    const source = `
      let res ='';
      for (const y of obj) {
        res += y;
        y = 345;
      }
      return res`;
    const localContext = {
      obj: [1, 2, 3]
    };

    // --- Act/Assert
    try {
      await execModule(source, localContext);
    } catch (err) {
      expect(err.toString().includes("const")).toBe(true);
      return;
    }
    assert.fail("Exception expected");
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
