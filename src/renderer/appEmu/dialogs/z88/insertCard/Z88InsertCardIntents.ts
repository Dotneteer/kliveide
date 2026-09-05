import type { Z88Environment } from "../Z88Ports";

/**
 * Everything a user can do in the Insert Card dialog, in the user's own
 * vocabulary.
 */
export type Z88InsertCardIntent =
  | { type: "environmentChanged"; env: Z88Environment }
  | { type: "cardTypeSelected"; cardTypeId: string }
  | { type: "selectCardFileRequested" }
  | { type: "clearCardFileRequested" }
  | { type: "insertRequested" }
  | { type: "closeRequested" };
