import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

import { compileNexFile } from "../../scripts/visual-tests/lib/compile-nex";

const T00 = resolve(__dirname, "copper/T00-static-ula/program.asm");

describe("visual tests - compile .asm to .nex", () => {
  it("produces a NEX whose header matches the source pragmas", async () => {
    const { bytes, contents } = await compileNexFile(T00);
    expect(bytes.length % 512).toBe(0);
    expect(contents.header.programCounter).toBe(0x8000);
    expect(contents.header.stackPointer).toBe(0xbff0);
    expect(contents.header.borderColor).toBe(2);
    expect(contents.header.bankFlags[2]).toBe(true);
    const bank2 = contents.bankData.find(([bank]) => bank === 2)![1];
    // di; ld a,2
    expect(Array.from(bank2.slice(0, 3))).toEqual([0xf3, 0x3e, 0x02]);
  });

  it("reports assembly errors with the file and line", async () => {
    await expect(compileNexFile(resolve(__dirname, "fixtures/broken.asm"))).rejects.toThrow(/broken\.asm:\d+/);
  });
});
