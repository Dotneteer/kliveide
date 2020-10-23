import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - ld operations", () => {
  it("Characters are just like numbers", () => {
    testCodeEmit("ld a,'A'", 0x3e, 0x41);
  });

  it("ld a,sin() fails", () => {
    codeRaisesError("ld a,sin()", "Z3001");
  });

  it("macro ivocation fails #1", () => {
    codeRaisesError(`
    erd .macro(arg)
    mamc({{arg}})
    .endm

    mamc .macro (sdds)
    .if isreg8({{sdds}})
    .endif
    .endm

    erd("(af)")
    `, "Z3001");
  });


});

