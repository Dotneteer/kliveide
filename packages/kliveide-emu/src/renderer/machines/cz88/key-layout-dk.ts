import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the DK keys that differ from the default layout
 */
const dkLayoutDiff: Cz88KeyboardLayout = {
  N1: {
    key: "1",
    symbol: "dk",
  },
}

/**
 * The DK Z88 keyboard layout
 */
export const dkZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...dkLayoutDiff }
