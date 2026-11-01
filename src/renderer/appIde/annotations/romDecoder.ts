import { MemorySectionType } from "@abstractions/MemorySection";
import type { RomDecoder, RomInstruction } from "@common/roms/romAnnotationTools";
import { romKindHasBasicCalls, romKindIsEnterprise, romKindIsTvc, romKindOrigin, romKindUsesZ80N, type RomPageKind } from "@common/roms/romIdentity";

import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { ZxSpectrum48CustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/zx-spectrum-48-disassembler";
import {
  plus3SyntaxDecoder,
  ZxSpectrum128EditorCustomDisassembler
} from "@renderer/appIde/disassemblers/z80-disassembler/zx-spectrum-128-editor-disassembler";
import { nextZxOsDecoderFor } from "@renderer/appIde/disassemblers/z80-disassembler/nextzxos-disassembler";
import { Zx80CustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/zx80-disassembler";
import { Zx81CustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/zx81-disassembler";
import { Ht1080zCustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/ht1080z-disassembler";
import { TvcCustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/tvc-disassembler";
import {
  EpBasicCustomDisassembler,
  EpCustomDisassembler
} from "@renderer/appIde/disassemblers/z80-disassembler/ep-disassembler";
import { ChainedCustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/rom-gated-disassembler";

/**
 * Install the ROM's own decoding on a disassembler: the report code after `RST $08` and the
 * calculator literals after `RST $28` on a 48K BASIC page, the ROM address after `RST $28` on the
 * 128K's and the +3's editor ROMs, the inline words and bytes after NextZXOS's restarts and
 * stub calls on its pages 0-2, the ZX81's equivalents on its ROM, the
 * error code after `RST $08` on the ZX80's 4K ROM, the syntax-check byte after `RST $08` (and the
 * tables the IDE lists as data) on the HT-1080Z's BASIC ROM, the function code after `RST $30` on the
 * TVC's BASIC ROMs, the EXOS function code after `RST 30h` on the Enterprise's ROMs (and IS-BASIC's
 * call byte after `RST 10h` on the pages that hold IS-BASIC). Any
 * other page decodes as plain Z80. Shared by the authoring tools and the ROM page documents, so a
 * listing and the level report never disagree about where the code is.
 */
export function prepareRomDisassembler(
  disassembler: Z80Disassembler,
  kind: RomPageKind | undefined
): void {
  if (kind === "sp48-basic" || kind === "next-basic") {
    disassembler.setCustomDisassembler(new ZxSpectrum48CustomDisassembler());
  }
  if (kind === "sp128-editor") disassembler.setCustomDisassembler(new ZxSpectrum128EditorCustomDisassembler());
  if (kind === "plus3-syntax") disassembler.setCustomDisassembler(plus3SyntaxDecoder());
  if (kind === "plus3-editor") {
    disassembler.setCustomDisassembler(new ZxSpectrum128EditorCustomDisassembler({ decodeErrorCalls: false, otherRom: "ROM 3" }));
  }
  const nextOs = nextZxOsDecoderFor(kind);
  if (nextOs) disassembler.setCustomDisassembler(nextOs);
  if (kind === "zx81") disassembler.setCustomDisassembler(new Zx81CustomDisassembler());
  if (kind === "zx80") disassembler.setCustomDisassembler(new Zx80CustomDisassembler());
  if (kind === "ht1080z-basic") disassembler.setCustomDisassembler(new Ht1080zCustomDisassembler());
  if (romKindIsTvc(kind)) disassembler.setCustomDisassembler(new TvcCustomDisassembler());
  if (romKindHasBasicCalls(kind)) {
    disassembler.setCustomDisassembler(
      new ChainedCustomDisassembler([new EpCustomDisassembler(), new EpBasicCustomDisassembler()])
    );
  } else if (romKindIsEnterprise(kind)) disassembler.setCustomDisassembler(new EpCustomDisassembler());
}

/**
 * A ROM page decoded with Klive's own disassembler, for the ROM annotation tools (§6 of
 * `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`: "the ROM bytes themselves, read through Klive's
 * own disassembler"). The ROM's custom decoding runs over the whole page — report codes after
 * `RST $08`, calculator literals after `RST $28` — so they are not taken for code.
 */
export function romDecoderFor(kind: RomPageKind | undefined): RomDecoder {
  const decode = decoderAtZero(kind);
  const origin = romKindOrigin(kind);
  if (!origin) return decode;
  // --- A page that runs above $0000 is decoded at its own address (with its own custom decoding),
  // --- so that its absolute jumps name its own offsets; a target outside the page is not the page's
  return async (bytes, start, end) => {
    const memory = new Uint8Array(origin + bytes.length);
    memory.set(bytes, origin);
    return (await decode(memory, origin + start, origin + end)).map(({ offset, length, target }) => ({
      offset: offset - origin,
      length,
      ...(target !== undefined && target >= origin && target < origin + bytes.length
        ? { target: target - origin }
        : {})
    }));
  };
}

/** The decoder that lists `bytes` from address 0 with the kind's custom decoding. */
function decoderAtZero(kind: RomPageKind | undefined): RomDecoder {
  return async (bytes, start, end) => {
    const disassembler = new Z80Disassembler(
      [new MemorySection(start, end, MemorySectionType.Disassemble)],
      bytes,
      undefined,
      // --- The Next's pages use the Z80N's extra opcodes; on any other ROM they are not instructions
      { allowExtendedSet: romKindUsesZ80N(kind) }
    );
    prepareRomDisassembler(disassembler, kind);
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
