import { describe, it } from "vitest";
import { Z80Tester } from "./z80-tester";
import { ZxSpectrum48CustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/zx-spectrum-48-disassembler";

describe("Disassembler - ZX Spectrum-specific", function () {
  it("RST $08 work as expected", async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new ZxSpectrum48CustomDisassembler(),
      ["rst $08", ".defb $0a"],
      0xcf,
      0x0a
    );
  });

  it("RST $08 goes on as expected", async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new ZxSpectrum48CustomDisassembler(),
      ["rst $08", ".defb $0a", "nop"],
      0xcf,
      0x0a,
      0x00
    );
  });

  it("RST $28 goes on as expected", async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new ZxSpectrum48CustomDisassembler(),
      ["rst $28", ".defb $38", "nop"],
      0xef,
      0x38,
      0x00
    );
  });

  it("RST $28 section works as expected", async () => {
    // --- Arrange
    const opCodes = [
      0xef, 0x02, 0xe1, 0x34, 0xf1, 0x38, 0xaa, 0x3b, 0x29, 0x38, 0x00
    ];
    const expected = [
      "rst $28",
      ".defb $02",
      ".defb $e1",
      ".defb $34",
      ".defb $f1, $38, $aa, $3b, $29",
      ".defb $38",
      "nop"
    ];
    const expComment = [
      "(invoke calculator)",
      "(delete)",
      "(get-mem-1)",
      "(stk-data)",
      "(1.442695)",
      "(end-calc)",
      undefined
    ];

    // --- Act
    await Z80Tester.TestCustomWithComments(
      new ZxSpectrum48CustomDisassembler(),
      expected,
      expComment,
      opCodes
    );
  });

  it("RST 8 work as expected", async () => {
    // --- Act
    await Z80Tester.TestCustomWithDecimal(
      new ZxSpectrum48CustomDisassembler(),
      ["rst 8", ".defb 10"],
      0xcf,
      0x0a
    );
  });

  it("RST 8 goes on as expected", async () => {
    // --- Act
    await Z80Tester.TestCustomWithDecimal(
      new ZxSpectrum48CustomDisassembler(),
      ["rst 8", ".defb 10", "nop"],
      0xcf,
      0x0a,
      0x00
    );
  });

  it("RST 40 goes on as expected", async () => {
    // --- Act
    await Z80Tester.TestCustomWithDecimal(
      new ZxSpectrum48CustomDisassembler(),
      ["rst 40", ".defb 56", "nop"],
      0xef,
      0x38,
      0x00
    );
  });

  it("RST 40 section works as expected", async () => {
    // --- Arrange
    const opCodes = [
      0xef, 0x02, 0xe1, 0x34, 0xf1, 0x38, 0xaa, 0x3b, 0x29, 0x38, 0x00
    ];
    const expected = [
      "rst 40",
      ".defb 2",
      ".defb 225",
      ".defb 52",
      ".defb 241, 56, 170, 59, 41",
      ".defb 56",
      "nop"
    ];
    const expComment = [
      "(invoke calculator)",
      "(delete)",
      "(get-mem-1)",
      "(stk-data)",
      "(1.442695)",
      "(end-calc)",
      undefined
    ];

    // --- Act
    await Z80Tester.TestCustomWithCommentsAndDecimal(
      new ZxSpectrum48CustomDisassembler(),
      expected,
      expComment,
      opCodes
    );
  });
});
