import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the FR keys that differ from the default layout
 */
const frLayoutDiff: Cz88KeyboardLayout = {
  N1: {
    key: "1",
    symbol: "fr",
  },
}

/**
 * The FR Z88 keyboard layout
 */
export const frZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...frLayoutDiff }
