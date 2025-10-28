import { WindowState } from "./WindowState";

export type AppSettings = {
  windowStates?: {
    emuWindow?: WindowState;
    ideWindow?: WindowState;
  };
};
