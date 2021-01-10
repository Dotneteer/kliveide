import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the SE keys that differ from the default layout
 */
const seLayoutDiff: Cz88KeyboardLayout = {
  N1: {
    key: "1",
    symbol: "se",
  },
}

/**
 * The SE Z88 keyboard layout
 */
export const seZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...seLayoutDiff }
