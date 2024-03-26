import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";

class ScriptConsole {
  // --- The store is used to dispatch actions
  constructor(private readonly store: Store<AppState>) {
  }

  assert(...args: any[]) {
    // console.assert(...args);
  }

  clear() {
    // console.clear();
  }

  log(...args: any[]) {
    console.log("CL", ...args);
  }
}

export const createScriptConsole = (store: Store<AppState>) => new ScriptConsole(store);