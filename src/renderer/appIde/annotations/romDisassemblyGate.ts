import type { BankSpace, SlotPaging } from "@common/annotations/bankSpace";
import type { CustomDisassemblyContext } from "@renderer/appIde/disassemblers/z80-disassembler/rom-gated-disassembler";

import { MI_ZX80, MI_ZX81 } from "@common/machines/constants";
import { isBasic48RomPage, isZx81Rom, type RomPageIdentity } from "@common/roms/romIdentity";

/**
 * The context a machine's custom disassembler is gated with (`rom-gated-disassembler.ts`): whether
 * the code at an address is in the ROM page it describes, under this refresh's paging.
 *
 * @param partition In a bank view, the one partition shown; absent in the 64K view
 * @param identityOf A ROM partition's identity (`getRomSources`), when known
 */
export function customDisassemblyContextFor(
  machineId: string | undefined,
  space: BankSpace | undefined,
  slots: SlotPaging,
  identityOf: (partition: number) => RomPageIdentity | undefined,
  partition?: number
): CustomDisassemblyContext {
  const romPartitionAt = (address: number): number | undefined => {
    if (partition !== undefined) return partition < 0 ? partition : undefined;
    const site = space?.siteAt(address & 0xffff, slots);
    return site?.kind === "rom" ? site.partition : undefined;
  };
  const zx = machineId === MI_ZX80 || machineId === MI_ZX81;
  return {
    inDescribedRom(address) {
      const rom = romPartitionAt(address);
      if (rom === undefined) return false;
      const identity = identityOf(rom);
      return zx ? isZx81Rom(machineId, identity) : isBasic48RomPage(machineId, rom, identity);
    }
  };
}
