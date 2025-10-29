import { ActionCreator } from "./Action";

export const emuLoadedAction: ActionCreator = () => {
  console.log('[Action] emuLoadedAction() called - creating EMU_LOADED action');
  return {
    type: "EMU_LOADED"
  };
};

export const emuSynchedAction: ActionCreator = () => ({
  type: "EMU_STATE_SYNCHED"
});

export const ideLoadedAction: ActionCreator = () => {
  console.log('[Action] ideLoadedAction() called - creating IDE_LOADED action');
  return {
    type: "IDE_LOADED"
  };
};

export const isWindowsAction: ActionCreator = (flag: boolean) => ({
  type: "IS_WINDOWS",
  payload: { flag }
});

export const emuFocusedAction: ActionCreator = (flag: boolean) => ({
  type: "EMU_FOCUSED",
  payload: { flag }
});

export const ideFocusedAction: ActionCreator = (flag: boolean) => ({
  type: "IDE_FOCUSED",
  payload: { flag }
});

export const setThemeAction: ActionCreator = (id: string) => ({
  type: "SET_THEME",
  payload: { id }
});

