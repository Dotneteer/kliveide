import type { Z88Environment } from "../Z88Ports";

export type Z88RemoveCardIntent =
  | { type: "environmentChanged"; env: Z88Environment }
  | { type: "removeRequested" }
  | { type: "closeRequested" };
