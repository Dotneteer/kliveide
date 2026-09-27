import { describe, expect, it } from "vitest";

import { compileBasic } from "./run-kit";
import { runBasicNext } from "./next-kit";

/**
 * CODEBANK code generation (plan §9) on the Next harness: banked routines run in their 8K pages at
 * the window through the far-call runtime, which keeps every register and the stack as a direct
 * call would, and gives the window back when control returns to resident code.
 */
const TWO_BANKS = [
  "DIM result AS UInteger",
  "CODEBANK 1",
  "FUNCTION Twice(n AS UInteger) AS UInteger",
  "  RETURN n * 2",
  "END FUNCTION",
  "END CODEBANK",
  "CODEBANK 2",
  "SUB Store(v AS UInteger)",
  "  result = Twice(v) + 1",
  "END SUB",
  "END CODEBANK",
  "Store 20",
  "PRINT result",
  ""
].join("\n");

describe("CODEBANK code generation", () => {
  it("calls across banks and back, and leaves the window as it found it", async () => {
    const r = await runBasicNext(TWO_BANKS);
    expect(r.word("result")).toBe(41);
    expect(r.screen()[0]).toBe("41");
    expect(r.session.mmuPage(3)).toBe(11);
    expect(r.session.peek(r.program.symbol("core.FarBank"))).toBe(0);
  });

  it("places each bank in its page, assembled for the window", async () => {
    const { generated } = await compileBasic(TWO_BANKS, { target: "next" });
    const banked = generated.output.segments.filter((s) => s.bank !== undefined);
    expect(banked.map((s) => [s.startAddress, s.bank, s.bankOffset])).toEqual([
      [0x6000, 15, 0],
      [0x6000, 15, 0x2000]
    ]);
  });
});
