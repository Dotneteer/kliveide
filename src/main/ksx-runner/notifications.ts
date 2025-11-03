import type { ScriptCallContext } from "./MainScriptManager";

import { endCompileAction, resetCompileAction, startCompileAction } from "@common/state/actions";

export interface INotifications {
    resetCompilation(): void;
    startCompilation(file?: string): void;
    completeCompilation(result?: any): void;
}

export function createNotifications(context: ScriptCallContext): INotifications {
  return {
    resetCompilation: () => {
      context.dispatch(resetCompileAction());
    },
    startCompilation: (file?: string) => {
      context.dispatch(startCompileAction(file));
    },
    completeCompilation: (result?: any) => {
      context.dispatch(endCompileAction(result));
    }
  }
}