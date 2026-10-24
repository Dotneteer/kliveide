import { readFileSync } from "node:fs";
import { join } from "node:path";

import { blankMdr, Interface1Support, type Interface1CorePrefix } from "@emu/machines/zxSpectrum/if1/if1CoreBridge";

/*
 * The Interface 1 for the 48K and 128K harnesses (`.plans/MICRODRIVE_PLAN.md` Phase 2): the same
 * bridge the IDE uses, over the session's machine.
 */

/** The shipped v2 ROM (`src/public/roms/if1-2.rom`) */
export const SHIPPED_IF1_ROM = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/if1-2.rom")));

export function interface1Of(prefix: Interface1CorePrefix, machine: { wasmV2Runtime?: { exports: object } }): Interface1Support {
  return new Interface1Support(prefix, { getIf1Runtime: () => machine.wasmV2Runtime });
}

/**
 * Connects the interface with a ROM (the shipped one by default). No reset: the ROM pages in at the
 * next fetch from $0008 or $1708, so a session booted to BASIC goes on there.
 */
export function connectInterface1(support: Interface1Support, rom: Uint8Array = SHIPPED_IF1_ROM): void {
  support.uploadRom(rom);
  support.setPresent(true);
}

/** An .mdr, or `{ blank: slots }` for an unformatted one */
export type HarnessCartridge = Uint8Array | { blank: number };

export function insertCartridge(
  support: Interface1Support,
  drive: number,
  cartridge: HarnessCartridge,
  writeProtected?: boolean
): void {
  const mdr = cartridge instanceof Uint8Array ? cartridge : blankMdr(cartridge.blank);
  if (!support.insert(drive, mdr, writeProtected)) throw new Error(`Not an .mdr: ${mdr.length} bytes`);
}
