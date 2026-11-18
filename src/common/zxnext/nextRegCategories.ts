/*
 * The NextReg categories the Next Registers document groups by.
 *
 * Taken from the "Quick Reference: Registers by Category" table at the end of the book's Appendix B
 * (`docs/content/en/book/app-B-nextreg-reference.md`), so the document and the book file every
 * register under the same headings. A register may sit in more than one category (`$69` is both
 * Layer 2 and ULA, `$06` both Audio and Peripherals): the table lists it in each, and so does the
 * document. A documented register the table does not list falls into "Other" — that is computed
 * from the descriptors (`nextRegCategoryGroups`), not listed here, so a new descriptor can never
 * disappear from the category view.
 *
 * Keys at definition, text at display (`dev/ai/i18n-guide.md`, rule 4): the table holds message
 * keys, never English.
 */
import type { MessageKey } from "@common/i18n/keys.generated";

export type NextRegCategoryId =
  | "identity"
  | "control"
  | "memory"
  | "layers"
  | "layer2"
  | "ula"
  | "sprites"
  | "tilemap"
  | "palettes"
  | "clip"
  | "raster"
  | "copper"
  | "audio"
  | "interrupts"
  | "joystick"
  | "keyboard"
  | "peripherals"
  | "divmmc"
  | "bus"
  | "pi"
  | "debugging"
  | "user"
  | "other";

export type NextRegCategory = {
  id: NextRegCategoryId;
  nameKey: MessageKey;
  descriptionKey: MessageKey;
  /** The registers, in the book's order. Empty for "Other", which is computed. */
  regs: readonly number[];
};

/** `from` to `to`, inclusive */
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const NEXT_REG_CATEGORIES: readonly NextRegCategory[] = [
  {
    id: "identity",
    nameKey: "panels.doc.nextRegs.cat.identity",
    descriptionKey: "panels.doc.nextRegs.catDesc.identity",
    regs: [0x00, 0x01, 0x0e, 0x0f]
  },
  {
    id: "control",
    nameKey: "panels.doc.nextRegs.cat.control",
    descriptionKey: "panels.doc.nextRegs.catDesc.control",
    regs: [0x02, 0x03, 0x07, 0x10, 0x24]
  },
  {
    id: "memory",
    nameKey: "panels.doc.nextRegs.cat.memory",
    descriptionKey: "panels.doc.nextRegs.catDesc.memory",
    regs: [0x04, ...range(0x50, 0x57), 0x8c, 0x8e, 0x8f]
  },
  {
    id: "layers",
    nameKey: "panels.doc.nextRegs.cat.layers",
    descriptionKey: "panels.doc.nextRegs.catDesc.layers",
    regs: [0x14, 0x15, 0x4a, 0x4b, 0x4c]
  },
  {
    id: "layer2",
    nameKey: "panels.doc.nextRegs.cat.layer2",
    descriptionKey: "panels.doc.nextRegs.catDesc.layer2",
    regs: [0x12, 0x13, 0x16, 0x17, 0x18, 0x69, 0x70, 0x71]
  },
  {
    id: "ula",
    nameKey: "panels.doc.nextRegs.cat.ula",
    descriptionKey: "panels.doc.nextRegs.catDesc.ula",
    regs: [0x11, 0x1a, 0x26, 0x27, 0x32, 0x33, 0x64, 0x68, 0x69, 0x6a]
  },
  {
    id: "sprites",
    nameKey: "panels.doc.nextRegs.cat.sprites",
    descriptionKey: "panels.doc.nextRegs.catDesc.sprites",
    regs: [0x19, 0x34, ...range(0x35, 0x39), ...range(0x75, 0x79)]
  },
  {
    id: "tilemap",
    nameKey: "panels.doc.nextRegs.cat.tilemap",
    descriptionKey: "panels.doc.nextRegs.catDesc.tilemap",
    regs: [0x1b, 0x2f, 0x30, 0x31, 0x6b, 0x6c, 0x6e, 0x6f]
  },
  {
    id: "palettes",
    nameKey: "panels.doc.nextRegs.cat.palettes",
    descriptionKey: "panels.doc.nextRegs.catDesc.palettes",
    regs: range(0x40, 0x44)
  },
  {
    id: "clip",
    nameKey: "panels.doc.nextRegs.cat.clip",
    descriptionKey: "panels.doc.nextRegs.catDesc.clip",
    regs: range(0x18, 0x1c)
  },
  {
    id: "raster",
    nameKey: "panels.doc.nextRegs.cat.raster",
    descriptionKey: "panels.doc.nextRegs.catDesc.raster",
    regs: [0x1e, 0x1f, 0x20, 0x22, 0x23]
  },
  {
    id: "copper",
    nameKey: "panels.doc.nextRegs.cat.copper",
    descriptionKey: "panels.doc.nextRegs.catDesc.copper",
    regs: range(0x60, 0x64)
  },
  {
    id: "audio",
    nameKey: "panels.doc.nextRegs.cat.audio",
    descriptionKey: "panels.doc.nextRegs.catDesc.audio",
    regs: [0x06, 0x08, 0x09, 0x2c, 0x2d, 0x2e, 0xa2]
  },
  {
    id: "interrupts",
    nameKey: "panels.doc.nextRegs.cat.interrupts",
    descriptionKey: "panels.doc.nextRegs.catDesc.interrupts",
    regs: [0xc0, 0xc2, 0xc3, ...range(0xc4, 0xcf)]
  },
  {
    id: "joystick",
    nameKey: "panels.doc.nextRegs.cat.joystick",
    descriptionKey: "panels.doc.nextRegs.catDesc.joystick",
    regs: [0x05, 0x0b, 0xb2]
  },
  {
    id: "keyboard",
    nameKey: "panels.doc.nextRegs.cat.keyboard",
    descriptionKey: "panels.doc.nextRegs.catDesc.keyboard",
    regs: [0x28, 0x29, 0x2a, 0x2b, 0xb0, 0xb1]
  },
  {
    id: "peripherals",
    nameKey: "panels.doc.nextRegs.cat.peripherals",
    descriptionKey: "panels.doc.nextRegs.catDesc.peripherals",
    regs: [0x06, 0x08, 0x09, 0x0a]
  },
  {
    id: "divmmc",
    nameKey: "panels.doc.nextRegs.cat.divmmc",
    descriptionKey: "panels.doc.nextRegs.catDesc.divmmc",
    regs: range(0xb8, 0xbb)
  },
  {
    id: "bus",
    nameKey: "panels.doc.nextRegs.cat.bus",
    descriptionKey: "panels.doc.nextRegs.catDesc.bus",
    regs: [0x80, 0x81, ...range(0x82, 0x89), 0x8a]
  },
  {
    id: "pi",
    nameKey: "panels.doc.nextRegs.cat.pi",
    descriptionKey: "panels.doc.nextRegs.catDesc.pi",
    regs: [...range(0x90, 0x93), ...range(0x98, 0x9b), 0xa0, 0xa2, 0xa8, 0xa9]
  },
  {
    id: "debugging",
    nameKey: "panels.doc.nextRegs.cat.debugging",
    descriptionKey: "panels.doc.nextRegs.catDesc.debugging",
    regs: [0xd8, 0xd9, 0xda, 0xf0, ...range(0xf8, 0xfa)]
  },
  {
    id: "user",
    nameKey: "panels.doc.nextRegs.cat.user",
    descriptionKey: "panels.doc.nextRegs.catDesc.user",
    regs: [0x7f]
  },
  {
    id: "other",
    nameKey: "panels.doc.nextRegs.cat.other",
    descriptionKey: "panels.doc.nextRegs.catDesc.other",
    regs: []
  }
];
