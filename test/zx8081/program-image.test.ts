import { describe, expect, it } from "vitest";

import {
  buildZx8081ProgramImage,
  Zx8081ImageError,
  zx81Float,
  ZX80_REM_BODY,
  ZX81_REM_BODY
} from "@common/zx8081/programImage";
import { parseZxProgramFile } from "@emu/machines/zx8081/ZxPFile";

/**
 * The ZX80/ZX81 program image builder (`.plans/ZX8081_CODE_INJECTION_PLAN.md` D3). The expected
 * bytes of the BASIC lines are what the machines themselves stored when the same lines were typed
 * on them (phase 0, recorded in the plan's §3); `test/zx8081-hw/program-image.test.ts` runs the
 * images on the real cores.
 */
const seg = (startAddress: number, ...code: number[]) => ({ startAddress, emittedCode: code });
const word = (data: Uint8Array, base: number, address: number) =>
  data[address - base] | (data[address - base + 1] << 8);

describe("ZX81 floating-point numbers", () => {
  it.each([
    [0, [0, 0, 0, 0, 0]],
    [1, [0x81, 0x00, 0, 0, 0]],
    [16514, [0x8f, 0x01, 0x04, 0x00, 0x00]],
    [65535, [0x90, 0x7f, 0xff, 0x00, 0x00]]
  ])("%i", (value, bytes) => {
    expect(zx81Float(value)).toEqual(bytes);
  });
});

describe("ZX81 REM-container image", () => {
  it("lays out 1 REM <code> and 2 RAND USR 16514 as the ZX81 stores them", () => {
    const image = buildZx8081ProgramImage([seg(ZX81_REM_BODY, 0x26, 0x27, 0x28)], undefined, true, { ramKb: 16 });
    expect(image.layout).toBe("rem");
    expect(image.entry).toBe(16514);
    const program = Array.from(image.data.slice(0x407d - 0x4009, 0x407d - 0x4009 + 27));
    expect(program).toEqual([
      // --- 1 REM ABC
      0x00, 0x01, 0x05, 0x00, 0xea, 0x26, 0x27, 0x28, 0x76,
      // --- 2 RAND USR 16514 (the digits, $7E and the number's 5-byte form)
      0x00, 0x02, 0x0e, 0x00, 0xf9, 0xd4, 0x1d, 0x22, 0x21, 0x1d, 0x20, 0x7e, 0x8f, 0x01, 0x04, 0x00, 0x00, 0x76
    ]);
  });

  it("keeps the system variables consistent with the layout", () => {
    const image = buildZx8081ProgramImage([seg(0x4082, 0xc9)], undefined, true, { ramKb: 16 });
    const w = (a: number) => word(image.data, 0x4009, a);
    const dFile = w(0x400c);
    expect(dFile).toBe(0x407d + 7 + 18);
    // --- An expanded display file: NEWLINE, then 24 lines of 32 spaces
    expect(w(0x4010) - dFile).toBe(1 + 24 * 33);
    expect(image.data[w(0x4010) - 0x4009]).toBe(0x80);
    expect(w(0x4014)).toBe(w(0x4010) + 1);
    expect(image.eLine).toBe(w(0x4014));
    expect(image.data.length).toBe(image.eLine - 0x4009);
    // --- No auto-run: NXTLIN at the display file's NEWLINE
    expect(w(0x4029)).toBe(dFile);
    expect(image.data[0x403b - 0x4009]).toBe(0x40);
  });

  it("collapses the display file for 1K and fits", () => {
    const image = buildZx8081ProgramImage([seg(0x4082, 0xc9)], undefined, true, { ramKb: 1 });
    const w = (a: number) => word(image.data, 0x4009, a);
    expect(w(0x4010) - w(0x400c)).toBe(25);
  });

  it("points NXTLIN at line 2 to run itself once loaded", () => {
    const image = buildZx8081ProgramImage([seg(0x4082, 0xc9)], undefined, true, { ramKb: 16, autoRun: true });
    expect(word(image.data, 0x4009, 0x4029)).toBe(0x407d + 7);
  });

  it("zero-fills the REM body below the code and calls the entry address", () => {
    const image = buildZx8081ProgramImage([seg(0x4090, 0x00, 0xc9)], 0x4091, true, { ramKb: 16 });
    const line1 = image.data.slice(0x407d - 0x4009);
    expect(line1[2] | (line1[3] << 8)).toBe(1 + 14 + 2 + 1);
    expect(Array.from(line1.slice(5, 5 + 14))).toEqual(new Array(14).fill(0));
    expect(image.entry).toBe(0x4091);
  });

  it("merges segments and holds NEWLINE bytes (the ZX81 walks lines by length)", () => {
    const image = buildZx8081ProgramImage([seg(0x4082, 0x76), seg(0x4085, 0xc9)], undefined, true, { ramKb: 16 });
    expect(Array.from(image.data.slice(0x4082 - 0x4009, 0x4086 - 0x4009))).toEqual([0x76, 0, 0, 0xc9]);
  });

  it("reads back as a .p file", () => {
    const image = buildZx8081ProgramImage([seg(0x4082, 0xc9)], undefined, true, { ramKb: 1 });
    const file = parseZxProgramFile(image.data, "out.p");
    expect(file?.isZx81).toBe(true);
    expect(file?.ramKb).toBe(1);
  });
});

describe("ZX80 REM-container image", () => {
  it("lays out 1 REM <code> and 2 RANDOMISE USR(16427) as the ZX80 stores them", () => {
    const image = buildZx8081ProgramImage([seg(ZX80_REM_BODY, 0x26, 0x27, 0x28)], undefined, false, { ramKb: 16 });
    expect(image.base).toBe(0x4000);
    expect(Array.from(image.data.slice(0x28))).toEqual([
      0x00, 0x01, 0xfe, 0x26, 0x27, 0x28, 0x76,
      0x00, 0x02, 0xef, 0x3a, 0x38, 0x37, 0xda, 0x1d, 0x22, 0x20, 0x1e, 0x23, 0xd9, 0x76,
      0x80
    ]);
    const w = (a: number) => word(image.data, 0x4000, a);
    expect(w(0x4008)).toBe(0x4028 + 21);
    expect(w(0x400a)).toBe(0x4028 + 22);
    expect(w(0x400c)).toBe(w(0x400a) + 2);
    expect(parseZxProgramFile(image.data, "out.o")?.isZx81).toBe(false);
  });

  it("refuses a NEWLINE byte in the REM body", () => {
    expect(() => buildZx8081ProgramImage([seg(0x402b, 0x00, 0x76)], undefined, false, { ramKb: 16 })).toThrow(
      /\$76 byte at \$402C/
    );
  });
});

describe("Full images and errors", () => {
  it("takes a full ZX81 image from $4009 as it is", () => {
    const rem = buildZx8081ProgramImage([seg(0x4082, 0xc9)], undefined, true, { ramKb: 16 });
    const full = buildZx8081ProgramImage([seg(0x4009, ...rem.data)], undefined, true, { ramKb: 16 });
    expect(full.layout).toBe("full");
    expect(full.data).toEqual(rem.data);
    expect(full.entry).toBeUndefined();
  });

  it("reports an inconsistent full image", () => {
    const rem = buildZx8081ProgramImage([seg(0x4082, 0xc9)], undefined, true, { ramKb: 16 });
    const bytes = [...rem.data, 0, 0];
    expect(() => buildZx8081ProgramImage([seg(0x4009, ...bytes)], undefined, true, { ramKb: 16 })).toThrow(
      /E_LINE is \$[0-9A-F]{4}, but the image ends at/
    );
  });

  it("refuses code inside the system variables", () => {
    expect(() => buildZx8081ProgramImage([seg(0x4040, 0xc9)], undefined, true, { ramKb: 16 })).toThrow(
      Zx8081ImageError
    );
  });

  it("refuses an entry outside the code", () => {
    expect(() => buildZx8081ProgramImage([seg(0x4082, 0xc9)], 0x5000, true, { ramKb: 16 })).toThrow(
      /entry address \$5000/
    );
  });

  it("refuses a program that does not fit 1K", () => {
    expect(() =>
      buildZx8081ProgramImage([seg(0x4082, ...new Array(900).fill(0))], undefined, true, { ramKb: 1 })
    ).toThrow(/does not fit a 1K ZX81/);
  });

  it("refuses banks and empty code", () => {
    expect(() => buildZx8081ProgramImage([{ ...seg(0x4082, 0xc9), bank: 1 }], undefined, true, { ramKb: 16 })).toThrow(
      /no memory banks/
    );
    expect(() => buildZx8081ProgramImage([], undefined, true, { ramKb: 16 })).toThrow(/no code/);
  });
});
