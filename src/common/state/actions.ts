import { ActionCreator } from "./Action";

export const emuLoadedAction: ActionCreator = () => ({
  type: "EMU_LOADED",
});

export const ideLoadedAction: ActionCreator = () => ({
  type: "IDE_LOADED",
});
