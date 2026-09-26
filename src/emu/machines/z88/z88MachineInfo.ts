/*
 * What a Cambridge Z88 tells the IDE and the frame pacing about itself, independent of the core that
 * emulates it: the clock and frame units, the ROM and keyboard-layout defaults, the partition names
 * and the disassembly sections.
 *
 * Shared by the machine (`Z88WasmHost`, `Z88WasmV2Machine`) and the renderer, so it must not import
 * the machine nor the renderer's command services (see `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`,
 * "Target Architecture").
 */
import { IMemorySection, MemorySectionType } from "@abstractions/MemorySection";

/* Local, so this neutral module does not depend on the renderer's command services */
const toHexa2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");

/** Why a Z88 refuses to inject or run IDE-built code (follow-up F4 of the WASM migration plan) */
export const Z88_NO_CODE_INJECTION =
  "The Cambridge Z88 cannot run code injected from the IDE: OZ owns the memory and its paging, so " +
  "there is no delivery route. Put the program on a card instead.";

/** The ROM loaded into slot 0 when the configuration names none */
export const Z88_DEFAULT_ROM = "z88v50b";

/**
 * Bundled ROM resources that were renamed. Projects and app settings persist the model's whole
 * configuration, ROM names included, so a stored configuration may still name the old resource.
 */
const Z88_RENAMED_ROMS: Record<string, string> = {
  // --- OZ v5.0 beta: the 2023 build was replaced by the V5.0B build (issue #1376)
  "z88v50-r1f99aaae": "z88v50b"
};

/**
 * Maps a ROM name taken from a (possibly stored) configuration to the bundled resource that now
 * carries it; any other name, including a file path, is returned unchanged.
 * @param romName The `MC_Z88_INTROM` value or the slot-0 card's `file`
 */
export function resolveZ88RomName<T extends string | undefined>(romName: T): T {
  return (romName !== undefined && Object.prototype.hasOwnProperty.call(Z88_RENAMED_ROMS, romName)
    ? Z88_RENAMED_ROMS[romName]
    : romName) as T;
}

/** The Z88's CPU clock: 3.2768 MHz */
export const Z88_BASE_CLOCK_FREQUENCY = 3_276_800;

/** One machine frame is 5 ms, the Blink's RTC tick: 16384 tacts at 3.2768 MHz */
export const Z88_TACTS_IN_FRAME = 16_384;

/** The LCD is rendered and the UI refreshed every 8th frame (every 40 ms) */
export const Z88_UI_FRAME_FREQUENCY = 8;

/** The keyboard layouts a model configuration (`MC_Z88_KEYBOARD`) may select */
export const Z88_KEYBOARD_LAYOUTS = ["uk", "de", "fr", "es", "it", "dk", "se"] as const;

/**
 * Resolves the keyboard layout of a machine configuration; unknown or missing values fall back to
 * the UK layout.
 * @param configured The `MC_Z88_KEYBOARD` value of the configuration
 */
export function resolveZ88KeyboardLayout(configured: unknown): string {
  return typeof configured === "string" &&
    (Z88_KEYBOARD_LAYOUTS as readonly string[]).includes(configured)
    ? configured
    : "uk";
}

/**
 * Parses a partition label (one or two hex digits) to get the partition (bank) number
 * @param label Label to parse
 */
export function parseZ88PartitionLabel(label: string): number | undefined {
  if (!label) return undefined;
  if (!label.match(/^[0-9a-fA-F]{1,2}$/)) {
    return undefined;
  }
  const partition = parseInt(label, 16);
  return partition >= 0 && partition < 256 ? partition : undefined;
}

/**
 * The labels of the 256 banks. A real `Record`, not a `string[]` returned as one: the array worked
 * by index, but it made the Z88 the only machine whose map could not be enumerated with
 * `Object.entries` the way every consumer does.
 */
export function z88PartitionLabels(): Record<number, string> {
  const labels: Record<number, string> = {};
  for (let i = 0; i <= 0xff; i++) {
    labels[i] = toHexa2(i);
  }
  return labels;
}

/**
 * The Z88 has no ROM partitions: its ROM is a card in slot 0 rather than a fixed page, so the bank
 * map is complete rather than missing entries (`.plans/PARTITION_NAMING_UNIFICATION_PLAN.md` §8,
 * decision 2). All partitions are banks, so the chooser needs one caption beside the grid.
 */
export function z88PartitionGroups(): Record<number, string> {
  const groups: Record<number, string> = {};
  for (let i = 0; i <= 0xff; i++) {
    groups[i] = "RAM Banks";
  }
  return groups;
}

/** The descriptions of the 256 banks */
export function z88PartitionDescriptions(): Record<number, string> {
  const descriptions: Record<number, string> = {};
  for (let i = 0; i <= 0xff; i++) {
    descriptions[i] = `Bank $${toHexa2(i)}`;
  }
  return descriptions;
}

/** A flag for each 8K page that indicates if the page is a ROM: none is, on the Z88 */
export function z88RomFlags(): boolean[] {
  return [false, false, false, false, false, false, false, false];
}

/**
 * Gets the disassembly sections: the whole 64K address space.
 *
 * The Z88's 64K is four segments of banks the Blink pages in (SR0-SR3); there is no fixed ROM, RAM or
 * screen range in it as on the ZX Spectrum, which is why the disassembly view hides its "RAM" and
 * "Screen" options for the Z88 (`CT_DISASSEMBLER_VIEW` in `machine-registry.ts`). The Spectrum ranges
 * this used to return left `$4000-$5AFF` (the Spectrum's screen) out of every Z88 disassembly -
 * follow-up F3 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.
 * @param _options The view's `ram` and `screen` options, which do not apply to the Z88
 */
export function z88DisassemblySections(_options: Record<string, any>): IMemorySection[] {
  return [
    {
      startAddress: 0x0000,
      endAddress: 0xffff,
      sectionType: MemorySectionType.Disassemble
    }
  ];
}

/** The LCD size registers (SCW, SCH) of the Blink */
export type Z88LcdSizeRegisters = { scw: number; sch: number };

/**
 * Gets the LCD size registers an `MC_SCREEN_SIZE` configuration value selects. SCW is $FF for a
 * 640-pixel LCD or the width in 8-pixel columns; SCH is the number of 8-line text rows. Unknown or
 * missing values select the Z88's own 640x64 LCD.
 * @param screenSize The `MC_SCREEN_SIZE` value: "640x320", "640x480", "800x320", "800x480"
 */
export function z88LcdSizeRegisters(screenSize: unknown): Z88LcdSizeRegisters {
  switch (screenSize) {
    case "640x320":
      return { scw: 0xff, sch: 40 };
    case "640x480":
      return { scw: 0xff, sch: 60 };
    case "800x320":
      return { scw: 100, sch: 40 };
    case "800x480":
      return { scw: 100, sch: 60 };
    default:
      return { scw: 0xff, sch: 8 };
  }
}
