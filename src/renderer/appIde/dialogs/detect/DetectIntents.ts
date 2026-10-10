import type { DetectEnvironment, DetectOptionsState } from "./DetectModel";

/** Everything a user can do in the Detect dialog. */
export type DetectIntent =
  | { type: "opened" }
  | { type: "environmentChanged"; env: DetectEnvironment }
  | { type: "optionsChanged"; patch: Partial<DetectOptionsState> }
  | { type: "detectRequested" }
  | { type: "includeToggled"; index: number }
  | { type: "detailsToggled"; index: number }
  | { type: "goToRequested"; index: number; offset: number }
  | { type: "applyRequested" }
  | { type: "undoRequested" }
  | { type: "coverageOnRequested" }
  | { type: "loadKcovRequested" }
  | { type: "closeRequested" };
