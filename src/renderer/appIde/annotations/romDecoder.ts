import { MemorySectionType } from "@abstractions/MemorySection";
import type { RomDecoder, RomInstruction } from "@common/roms/romAnnotationTools";
import type { RomPageKind } from "@common/roms/romIdentity";

import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { ZxSpectrum48CustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/zx-spectrum-48-disassembler";
import { Zx81CustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/zx81-disassembler";

/**
 * A ROM page decoded with Klive's own disassembler, for the ROM annotation tools (§6 of
 * `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`: "the ROM bytes themselves, read through Klive's
 * own disassembler"). The ROM's custom decoding runs over the whole page — report codes after
 * `RST $08`, calculator literals after `RST $28` — so they are not taken for code.
 */
export function romDecoderFor(kind: RomPageKind | undefined): RomDecoder {
  return async (bytes, start, end) => {
    const disassembler = new Z80Disassembler(
      [new MemorySection(start, end, MemorySectionType.Disassemble)],
      bytes,
      undefined,
      { allowExtendedSet: false }
    );
    if (kind === "sp48-basic") disassembler.setCustomDisassembler(new ZxSpectrum48CustomDisassembler());
    if (kind === "zx81") disassembler.setCustomDisassembler(new Zx81CustomDisassembler());
    const output = await disassembler.disassemble(start, end);
    return (output?.outputItems ?? [])
      .filter((item) => !item.isPrefixItem)
      .map((item): RomInstruction => {
        const target = item.branch?.target;
        return {
          offset: item.address,
          length: item.opCodes?.length ?? 1,
          ...(target !== undefined && item.branch?.kind !== "ret" ? { target } : {})
        };
      });
  };
}
