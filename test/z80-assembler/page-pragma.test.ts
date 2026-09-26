import { describe, it, expect } from "vitest";
import { MI_ZXNEXT } from "@common/machines/constants";
import { resolvedPartitionFor } from "@common/utils/source-breakpoint-partition";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { NexFileWriter } from "@main/z80-compiler/nex-file-writer";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

async function compile(source: string, model?: number) {
  const options = new AssemblerOptions();
  if (model !== undefined) options.currentModel = model;
  return await new Z80Assembler().compile(source, options);
}

function codeSegments(output: Awaited<ReturnType<typeof compile>>) {
  return output.segments.filter((s) => s.emittedCode.length);
}

/** The 16K banks stored in a NEX file with no screens, palette or copper: flags at 18, data after 512. */
function nexBanks(nex: Uint8Array): Map<number, Uint8Array> {
  const order = [5, 2, 0, 1, 3, 4, ...Array.from({ length: 106 }, (_, i) => i + 6)];
  const banks = new Map<number, Uint8Array>();
  let offset = 512;
  for (const bank of order) {
    if (!nex[18 + bank]) continue;
    banks.set(bank, nex.slice(offset, offset + 0x4000));
    offset += 0x4000;
  }
  return banks;
}

describe("Assembler - .page pragma", () => {
  it("assembles for $C000 when the page is even", async () => {
    const output = await compile(".model next\n.page 30\nStart: ld a,1\n");
    expect(output.errorCount).toBe(0);
    const [segment] = codeSegments(output);
    expect(segment).toMatchObject({ bank: 15, bankOffset: 0, startAddress: 0xc000, maxCodeLength: 0x2000 });
    expect(output.getSymbol("Start")?.value?.value).toBe(0xc000);
  });

  it("assembles for $E000 when the page is odd", async () => {
    const output = await compile(".model next\n.page 31\n  nop\n");
    expect(codeSegments(output)[0]).toMatchObject({ bank: 15, bankOffset: 0x2000, startAddress: 0xe000 });
  });

  it("assembles for an explicit address", async () => {
    const output = await compile(".model next\n.page 40, $6000\nFar: ld a,1\n  ret\n");
    expect(output.errorCount).toBe(0);
    expect(codeSegments(output)[0]).toMatchObject({ bank: 20, bankOffset: 0, startAddress: 0x6000 });
    expect(output.getSymbol("Far")?.value?.value).toBe(0x6000);
  });

  it("keeps the address's offset within its 8K slot", async () => {
    const output = await compile(".model next\n.page 41, $6100\n  nop\n");
    expect(codeSegments(output)[0]).toMatchObject({
      bank: 20,
      bankOffset: 0x2100,
      startAddress: 0x6100,
      maxCodeLength: 0x1f00
    });
  });

  it("starts a new segment for each page", async () => {
    const output = await compile(".model next\n  nop\n.page 30, $6000\n  nop\n.page 31, $6000\n  nop\n");
    expect(output.errorCount).toBe(0);
    expect(codeSegments(output).map((s) => [s.bank, s.bankOffset, s.startAddress])).toEqual([
      [undefined, undefined, 0x8000],
      [15, 0, 0x6000],
      [15, 0x2000, 0x6000]
    ]);
  });

  it("works with the Next model set in the options", async () => {
    const output = await compile(".page 30\n  nop\n", 4);
    expect(output.errorCount).toBe(0);
  });

  it("does not leave a page segment among the unbanked ones", async () => {
    const output = await compile(".model next\n.page 31\n  nop\n");
    expect(output.unbankedSegments?.some((s) => s.bank !== undefined)).toBeFalsy();
  });

  it("fails when the 8K page overflows", async () => {
    const output = await compile(".model next\n.page 30, $7ffe\n  nop\n  nop\n  nop\n");
    expect(output.errors.map((e) => e.errorCode)).toContain("Z0411");
  });

  it("rejects a label", async () => {
    const output = await compile(".model next\nMyPage: .page 30\n");
    expect(output.errors[0].errorCode).toBe("Z0332");
  });

  it("needs the Next model", async () => {
    const output = await compile(".model Spectrum128\n.page 30\n  nop\n");
    expect(output.errors[0].errorCode).toBe("Z0333");
  });

  it("rejects a page out of range", async () => {
    expect((await compile(".model next\n.page 224\n")).errors[0].errorCode).toBe("Z0334");
    expect((await compile(".model next\n.page -1\n")).errors[0].errorCode).toBe("Z0334");
  });

  it("rejects an address out of range", async () => {
    expect((await compile(".model next\n.page 30, $FFFF+1\n")).errors[0].errorCode).toBe("Z0335");
  });

  it("maps its lines to the page's partition for source breakpoints", async () => {
    const output = await compile(".model next\n.page 41, $6000\n  nop\n  nop\n");
    const [segment] = codeSegments(output);
    expect(resolvedPartitionFor(segment, 0x6001, MI_ZXNEXT)).toBe(41);
  });
});

describe("NEX export - placement by bank offset", () => {
  async function nexOf(source: string) {
    const output = await compile(`.model next\n.savenex file "t.nex"\n${source}`);
    expect(output.errorCount).toBe(0);
    return nexBanks(await NexFileWriter.fromAssemblerOutput(output, "/tmp"));
  }

  it("places .page code by its page, not its address", async () => {
    const banks = await nexOf(".page 30, $6000\n  .defb 1,2\n.page 31, $6000\n  .defb 3,4\n");
    const bank15 = banks.get(15)!;
    expect([bank15[0], bank15[1]]).toEqual([1, 2]);
    expect([bank15[0x2000], bank15[0x2001]]).toEqual([3, 4]);
  });

  it("places an even page assembled for $E000 in the bank's lower half", async () => {
    const banks = await nexOf(".page 32, $E000\n  .defb 7\n");
    expect(banks.get(16)![0]).toBe(7);
  });

  it("still places .bank code at its offset", async () => {
    const banks = await nexOf(".bank 20, $0100\n  .defb 9\n");
    expect(banks.get(20)![0x100]).toBe(9);
  });

  it("keeps a .bank offset when .org changes the assembly address", async () => {
    // --- pragmas.mdx, "Using BANK with offset and ORG": the code still starts at the bank offset
    const output = await compile(".model next\n.bank 20, $100\n.org $8000\n  .defb 5\n");
    expect(codeSegments(output)[0]).toMatchObject({ bank: 20, bankOffset: 0x100, startAddress: 0x8000 });
    const banks = await nexOf(".bank 20, $100\n.org $8000\n  .defb 5\n");
    expect(banks.get(20)![0x100]).toBe(5);
    expect(banks.get(20)![0]).toBe(0);
  });
});
