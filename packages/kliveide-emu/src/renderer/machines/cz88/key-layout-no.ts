import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the NO keys that differ from the default layout
 */
const noLayoutDiff: Cz88KeyboardLayout = {
  N1: {
    key: "1",
    symbol: "no",
  },
}

/**
 * The NO Z88 keyboard layout
 */
export const noZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...noLayoutDiff }
