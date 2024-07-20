import { describe, it } from "vitest";
import { Z80Tester } from "./z80-tester";
import { ZxSpectrumNextCustomDisassembler } from "@renderer/appIde/z80-disassembler/zx-spectrum-next-disassembler";

describe("Disassembler - ZX Spectrum Next specific", function () {
  it("RST $18 work as expected", async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new ZxSpectrumNextCustomDisassembler(),
      ["rst $18", ".defw $1234"],
      0xdf,
      0x34,
      0x12
    );
  });

  it("RST $18 goes on as expected", async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new ZxSpectrumNextCustomDisassembler(),
      ["rst $18", ".defw $1234", "nop"],
      0xdf,
      0x34,
      0x12,
      0x00
    );
  });

  it("RST $20 work as expected", async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new ZxSpectrumNextCustomDisassembler(),
      ["rst $20", ".defw $1234"],
      0xe7,
      0x34,
      0x12
    );
  });

  it("RST $20 goes on as expected", async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new ZxSpectrumNextCustomDisassembler(),
      ["rst $20", ".defw $1234", "nop"],
      0xe7,
      0x34,
      0x12,
      0x00
    );
  });

  it("RST $28 work as expected", async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new ZxSpectrumNextCustomDisassembler(),
      ["rst $28", ".defw $1234"],
      0xef,
      0x34,
      0x12
    );
  });

  it("RST $28 goes on as expected", async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new ZxSpectrumNextCustomDisassembler(),
      ["rst $28", ".defw $1234", "nop"],
      0xef,
      0x34,
      0x12,
      0x00
    );
  });
});
