import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the DE keys that differ from the default layout
 */
const deLayoutDiff: Cz88KeyboardLayout = {
  N1: {
    key: "1",
    symbol: "de",
  },
}

/**
 * The DE Z88 keyboard layout
 */
export const deZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...deLayoutDiff }
