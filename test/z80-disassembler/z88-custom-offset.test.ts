import { describe, expect, it } from "vitest";
import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { Z88CustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z88-custom.disassembler";

/*
 * A custom disassembler's items follow the listing's address offset, like the built-in ones.
 *
 * A popped-out Z88 bank is listed at the segment it runs in (`$C000`), so its bytes are disassembled
 * from offset 0 with an address offset. The custom disassembler addressed its OZ calls by raw offset,
 * so `oz OS_BOUT` at $C003 appeared as $0003, out of order with the rows around it.
 */
describe("Disassembler - custom items, their addresses and their bytes", () => {
  async function listing(addressOffset: number) {
    // --- nop; oz OS_BOUT; rst oz_mbp; nop
    const bytes = new Uint8Array([0x00, 0xe7, 0x90, 0xf7, 0x00]);
    const disassembler = new Z80Disassembler([new MemorySection(0, bytes.length - 1)], bytes);
    disassembler.setAddressOffset(addressOffset);
    disassembler.setCustomDisassembler(new Z88CustomDisassembler());
    const output = await disassembler.disassemble(0, bytes.length - 1);
    return output!.outputItems.map((item) => [item.address, item.instruction]);
  }

  it("numbers custom items like built-in ones", async () => {
    expect(await listing(0xc000)).toEqual([
      [0xc000, "nop"],
      [0xc001, "oz OS_BOUT"],
      [0xc003, "rst oz_mbp"],
      [0xc004, "nop"]
    ]);
  });

  it("keeps each item's own bytes when a custom item follows a built-in one", async () => {
    // --- or $EF; rst oz_mbp; extcall $5BD5F7 (the sample's bank $81 at $C027)
    const bytes = new Uint8Array([0xf6, 0xef, 0xf7, 0xef, 0xf7, 0xd5, 0x5b]);
    const disassembler = new Z80Disassembler([new MemorySection(0, bytes.length - 1)], bytes);
    disassembler.setCustomDisassembler(new Z88CustomDisassembler());
    const output = await disassembler.disassemble(0, bytes.length - 1);
    expect(output!.outputItems.map((item) => [item.instruction, item.opCodes])).toEqual([
      ["or $EF", [0xf6, 0xef]],
      ["rst oz_mbp", [0xf7]],
      ["extcall $5bd5f7", [0xef, 0xf7, 0xd5, 0x5b]]
    ]);
  });

  it("leaves a listing without an offset as it was", async () => {
    expect((await listing(0)).map(([address]) => address)).toEqual([0, 1, 3, 4]);
  });
});
