import "mocha";
import { expect } from "expect";

import { testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "@main/z80-compiler/assembler";

describe("Assembler - struct invocation regression", () => {
  it("Struct regression issue (ID casing) #1", async () => {
    await testCodeEmit(`
      Point2d:
      .struct
        X: .db 0
        Y: .db 0
      .ends

      ld hl,SnakeHead + Point2d.X
      ld hl,SnakeHead + Point2d.Y

      SnakeHead: Point2d()
    `, 0x21, 0x06, 0x80, 0x21, 0x07, 0x80, 0x00, 0x00);
  });

  it("Struct regression issue (ID casing) #2", async () => {
    await testCodeEmit(`
      Point2d:
      .struct
        X: .db 0
        Y: .db 0
      .ends

      ld hl,ThisShouldNotFail

      SnakeHead: Point2d()
      ThisShouldNotFail: .db #55
    `, 0x21, 0x05, 0x80, 0x00, 0x00, 0x55);
  });

  it("Struct regression issue (ID casing) #2a", async () => {
    await testCodeEmit(`
      Point2d:
      .struct
        X: .db 0
        Y: .db 0
      .ends

      ld hl,ThisShouldNotFail

      SnakeHead: Point2d()
        -> .dw 0xBEEF
      ThisShouldNotFail: .db #55
    `, 0x21, 0x05, 0x80, 0xEF, 0xBE, 0x55);
  });

  it("Struct regression issue (No scope labels override)", async () => {
    const compiler = new Z80Assembler();
    const source = `
    Object2D: .struct
      X: .defw 0
      Y: .defw 0
      DX: .defb 1
      DY: .defb 1
    .ends

    DY: Object2d()

    Apple: Object2D()
      X -> .defw 100
      Y -> .defw 100

    Pear:
    Object2D()
      X -> .defw 100
      DY -> .defb 100 ; this should not clash with scope's DY

    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
  });
});
