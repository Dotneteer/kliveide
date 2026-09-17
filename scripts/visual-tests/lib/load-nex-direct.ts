import type { NexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";
import type { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";

/** NextReg select / data ports. Writing through them is the hardware path in both cores. */
const NEXTREG_SELECT = 0x243b;
const NEXTREG_DATA = 0x253b;

/**
 * 8K MMU pages after `.nexload` hands over: ROM in slots 0-1, then bank 5, bank 2, bank 0 —
 * the classic 128K layout expressed as 8K pages (bank n = pages 2n and 2n+1).
 */
const NEX_DEFAULT_MMU = [0xff, 0xff, 10, 11, 4, 5, 0, 1];

export type DirectLoadResult = {
  /** State the direct loader does *not* reproduce compared to NextZXOS. Reported, not hidden. */
  differencesFromNexload: string[];
};

export function writeNextReg(machine: ZxNextMachine, reg: number, value: number): void {
  machine.doWritePort(NEXTREG_SELECT, reg & 0xff);
  machine.doWritePort(NEXTREG_DATA, value & 0xff);
}

export function readNextReg(machine: ZxNextMachine, reg: number): number {
  machine.doWritePort(NEXTREG_SELECT, reg & 0xff);
  return machine.doReadPort(NEXTREG_DATA);
}

/**
 * Test-only NEX loader. **Not** what the IDE does.
 *
 * `nex-run` boots NextZXOS and types `.nexload`, which takes seconds of emulated time and needs an
 * SD card image. For a pixel test the interesting part starts at the entry point, so this loader
 * puts the machine in the state the NEX format promises at that point: banks copied into RAM,
 * default MMU paging (with the entry bank at $C000), border, SP and PC. Everything goes through
 * the machine's public port/memory API, so the same code drives the TypeScript and WASM cores.
 *
 * What NextZXOS leaves behind that this does not (ROM selection, NextReg values the OS changes,
 * interrupt mode, sysvars) is listed in the result. Tier 2 runs the real `nex-run` path to catch
 * a test that silently depends on any of it.
 */
export function loadNexDirect(machine: ZxNextMachine, nex: NexFileContents): DirectLoadResult {
  const { header } = nex;

  // --- Copy each bank through slot 6/7 ($C000-$FFFF), the one window never needed by the loader.
  for (const [bank, data] of nex.bankData) {
    writeNextReg(machine, 0x56, bank * 2);
    writeNextReg(machine, 0x57, bank * 2 + 1);
    for (let i = 0; i < data.length; i++) {
      machine.doWriteMemory(0xc000 + i, data[i]);
    }
  }

  // --- The loading screens and palette are not applied: none of the visual tests use them, and
  // --- applying them only here would make Tier 1 and Tier 2 disagree about the first frame.
  if (header.screenBlockFlags & 0x1f) {
    throw new Error("loadNexDirect does not support NEX loading screens.");
  }

  const mmu = [...NEX_DEFAULT_MMU];
  if (header.entryBank) {
    mmu[6] = header.entryBank * 2;
    mmu[7] = header.entryBank * 2 + 1;
  }
  mmu.forEach((page, slot) => writeNextReg(machine, 0x50 + slot, page));

  machine.doWritePort(0x00fe, header.borderColor & 0x07);
  machine.sp = header.stackPointer;
  machine.pc = header.programCounter;
  machine.iff1 = false;
  machine.iff2 = false;

  return {
    differencesFromNexload: [
      "ROM in slots 0-1 is whatever hard reset selected, not NextZXOS's 48K BASIC ROM",
      "NextReg values set by the boot firmware and NextZXOS are at hardware reset defaults",
      "interrupts are disabled and the interrupt mode is the reset default",
      "no system variables are initialised"
    ]
  };
}
