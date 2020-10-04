import "mocha";
import { testCodeEmit } from "./test-helpers";

describe("Assembler - control flow operations", () => {
  it("ret", () => {
    testCodeEmit("ret", 0xc9);
    testCodeEmit("ret nz", 0xc0);
    testCodeEmit("ret z", 0xc8);
    testCodeEmit("ret nc", 0xd0);
    testCodeEmit("ret c", 0xd8);
    testCodeEmit("ret po", 0xe0);
    testCodeEmit("ret pe", 0xe8);
    testCodeEmit("ret p", 0xf0);
    testCodeEmit("ret m", 0xf8);
  });
});
