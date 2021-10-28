import { Z80Tester } from "./z80-tester";
import { intToX2 } from "../../modules/cpu-z80/disassembly-helper";
import { CambridgeZ88CustomDisassembler, z88FppApis, z88OzApis } from "@ext/vm-z88/CambridgeZ88CustomDisassembler";

describe("Disassembler - Z88-specific", function () {
  this.timeout(10000);

  for (var key in z88FppApis) {
    const fppCode = parseInt(key);
    it(`RST $18/${intToX2(fppCode)}: ${z88FppApis[fppCode]}`, async () => {
      // --- Act
      await Z80Tester.TestCustom(
        new CambridgeZ88CustomDisassembler(),
        [`fpp ${z88FppApis[fppCode].toLowerCase()}`, "nop"],
        0xdf,
        fppCode,
        0x00
      );
    });
  }

  for (var key in z88OzApis) {
    const fppCode = parseInt(key);
    if (fppCode === 0x93) {
      continue;
    }
    it(`RST $20/${intToX2(fppCode)}: ${z88OzApis[fppCode]}`, async () => {
      // --- Act
      const opcodes: number[] =
        fppCode < 256
          ? [0xe7, fppCode, 0x00]
          : [0xe7, fppCode & 0xff, fppCode >> 8, 0x00];
      await Z80Tester.TestCustom(
        new CambridgeZ88CustomDisassembler(),
        [`oz ${z88OzApis[fppCode].toLowerCase()}`, "nop"],
        ...opcodes
      );
    });
  }

  it(`RST $20/93: OS_POUT #1`, async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new CambridgeZ88CustomDisassembler(),
      [`oz ${z88OzApis[0x93].toLowerCase()}`, '.defb $00'],
      0xe7, 0x93, 0x00
    );
  });

  it(`RST $20/93: OS_POUT #2`, async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new CambridgeZ88CustomDisassembler(),
      [`oz ${z88OzApis[0x93].toLowerCase()}`, '.defb "abcd", $00'],
      0xe7, 0x93, 0x41, 0x42, 0x43, 0x44, 0x00
    );
  });

  it(`RST $20/93: OS_POUT #3`, async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new CambridgeZ88CustomDisassembler(),
      [`oz ${z88OzApis[0x93].toLowerCase()}`, '.defb "a", $12, "cd", $00'],
      0xe7, 0x93, 0x41, 0x12, 0x43, 0x44, 0x00
    );
  });

  it(`RST $20/93: OS_POUT #4`, async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new CambridgeZ88CustomDisassembler(),
      [`oz ${z88OzApis[0x93].toLowerCase()}`, '.defb $12, "bcd", $00'],
      0xe7, 0x93, 0x12, 0x42, 0x43, 0x44, 0x00
    );
  });

  it(`RST $20/93: OS_POUT #5`, async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new CambridgeZ88CustomDisassembler(),
      [`oz ${z88OzApis[0x93].toLowerCase()}`, '.defb $12, "b", $13, "d", $00'],
      0xe7, 0x93, 0x12, 0x42, 0x13, 0x44, 0x00
    );
  });

  it("RST $28", async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new CambridgeZ88CustomDisassembler(),
      [`extcall $ac2312`, "nop"],
      0xef,
      0x12,
      0x23,
      0xac,
      0x00
    );
  });

  it("RST $30", async () => {
    // --- Act
    await Z80Tester.TestCustom(
      new CambridgeZ88CustomDisassembler(),
      [`rst oz_mbp`, "nop"],
      0xf7,
      0x00
    );
  });
});
