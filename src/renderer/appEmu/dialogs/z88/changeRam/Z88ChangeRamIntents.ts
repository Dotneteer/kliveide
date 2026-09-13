import type { Z88Environment } from "../Z88Ports";

/**
 * Everything a user can do in the Change RAM dialog, in the user's own
 * vocabulary.
 */
export type Z88ChangeRamIntent =
  | { type: "environmentChanged"; env: Z88Environment }
  | { type: "ramSizeSelected"; size: string }
  | { type: "applyRequested" }
  | { type: "closeRequested" };
