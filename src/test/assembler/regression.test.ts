import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - regression cases", () => {
  it("Characters are just like numbers", async () => {
    await testCodeEmit("ld a,'A'", 0x3e, 0x41);
  });

  it("ld a,sin() fails", async () => {
    await codeRaisesError("ld a,sin()", "Z0606");
  });

  it("macro ivocation fails #1", async () => {
    await codeRaisesError(`
    erd .macro(arg)
    mamc({{arg}})
    .endm

    mamc .macro (sdds)
    .if isreg8({{sdds}})
    .endif
    .endm

    erd("(af)")
    `, "Z1012", "Z0111");
  });
});

