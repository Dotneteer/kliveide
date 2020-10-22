import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - ld operations", () => {
  it("Characters are just like numbers", () => {
    testCodeEmit("ld a,'A'", 0x3e, 0x41);
  });

});