import "mocha";

import { testCodeEmit } from "./test-helpers";

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
});