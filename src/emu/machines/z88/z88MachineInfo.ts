/*
 * What a Cambridge Z88 tells the IDE and the frame pacing about itself, independent of the core that
 * emulates it: the clock and frame units, the ROM and keyboard-layout defaults, the partition names
 * and the disassembly sections.
 *
 * Neutral: the TypeScript `Z88Machine` uses these values, and the WASM Z88 machine will. It must not
 * import any TypeScript Z88 device or card class, nor the renderer's command services (see
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`, "Target Architecture").
 */
import { IMemorySection, MemorySectionType } from "@abstractions/MemorySection";

/* Local, so this neutral module does not depend on the renderer's command services */
const toHexa2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");

/** The ROM loaded into slot 0 when the configuration names none */
export const Z88_DEFAULT_ROM = "z88v50-r1f99aaae";

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
 * Gets the disassembly sections for the specified options.
 *
 * Note: these ranges are the ZX Spectrum's (screen at $4000-$5AFF, RAM from $5B00); the Z88 has no
 * such layout. Kept verbatim for backend parity - follow-up F3 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.
 * @param options The `ram` and `screen` disassembly options
 */
export function z88DisassemblySections(options: Record<string, any>): IMemorySection[] {
  const ram = !!options.ram;
  const screen = !!options.screen;
  const sections: IMemorySection[] = [];
  if (!ram || !screen) {
    // --- Use the memory segments according to the "ram" and "screen" flags
    sections.push({
      startAddress: 0x0000,
      endAddress: 0x3fff,
      sectionType: MemorySectionType.Disassemble
    });
    if (ram) {
      if (screen) {
        sections.push({
          startAddress: 0x4000,
          endAddress: 0xffff,
          sectionType: MemorySectionType.Disassemble
        });
      } else {
        sections.push({
          startAddress: 0x5b00,
          endAddress: 0xffff,
          sectionType: MemorySectionType.Disassemble
        });
      }
    } else if (screen) {
      sections.push({
        startAddress: 0x4000,
        endAddress: 0x5aff,
        sectionType: MemorySectionType.Disassemble
      });
    }
  } else {
    // --- Disassemble the whole memory
    sections.push({
      startAddress: 0x0000,
      endAddress: 0xffff,
      sectionType: MemorySectionType.Disassemble
    });
  }

  return sections;
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
