import { describe, it } from "vitest";
import { Z80Tester } from "./z80-tester";
import { Zx81CustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/zx81-disassembler";

/**
 * The ZX81's custom disassembly (`.plans/ZX8081_WASM_PLAN.md` §11): the error code after RST $08 and
 * the calculator literals after RST $28, whose numbering (the ROM's table at $1923) differs from the
 * Spectrum's - `end-calc` is $34 here, $38 on the Spectrum.
 */
describe("Disassembler - ZX81-specific", () => {
  it("RST $08 is followed by an error code: the ROM's REPORT-F ($02F4)", async () => {
    await Z80Tester.TestCustomWithComments(
      new Zx81CustomDisassembler(),
      -1,
      ["rst $08", ".defb $0e", "nop"],
      ["(report error)", "(report f)", undefined],
      [0xcf, 0x0e, 0x00]
    );
  });

  it("RST $28 runs the calculator until end-calc ($34): stk-zero, end-calc (ROM $0DA2)", async () => {
    await Z80Tester.TestCustomWithComments(
      new Zx81CustomDisassembler(),
      -1,
      ["rst $28", ".defb $a0", ".defb $34", "nop"],
      ["(invoke calculator)", "(stk-zero)", "(end-calc)", undefined],
      [0xef, 0xa0, 0x34, 0x00]
    );
  });

  it("decodes stk-data's compact number, memory and jump literals", async () => {
    await Z80Tester.TestCustomWithComments(
      new Zx81CustomDisassembler(),
      -1,
      ["rst $28", ".defb $30", ".defb $30, $00", ".defb $c1", ".defb $e1", ".defb $00, $02", ".defb $2d", ".defb $34", "nop"],
      [
        "(invoke calculator)",
        "(stk-data)",
        // --- Exponent $30 + $50 = $80 and a zero mantissa: 0.5
        "(0.500000)",
        "(st-mem-1)",
        "(get-mem-1)",
        "(jump-true: l0009)",
        "(duplicate)",
        "(end-calc)",
        undefined
      ],
      [0xef, 0x30, 0x30, 0x00, 0xc1, 0xe1, 0x00, 0x02, 0x2d, 0x34, 0x00]
    );
  });

  it("$38 is e-to-fp on the ZX81, not end-calc", async () => {
    await Z80Tester.TestCustomWithComments(
      new Zx81CustomDisassembler(),
      -1,
      ["rst $28", ".defb $38", ".defb $34", "nop"],
      ["(invoke calculator)", "(e-to-fp)", "(end-calc)", undefined],
      [0xef, 0x38, 0x34, 0x00]
    );
  });
});
