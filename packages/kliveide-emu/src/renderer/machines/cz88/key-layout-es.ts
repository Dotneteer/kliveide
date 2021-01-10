import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the ES keys that differ from the default layout
 */
const esLayoutDiff: Cz88KeyboardLayout = {
  N1: {
    key: "1",
    symbol: "es",
  },
}

/**
 * The ES Z88 keyboard layout
 */
export const esZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...esLayoutDiff }
