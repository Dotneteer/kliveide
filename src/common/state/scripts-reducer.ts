import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import { Action } from "./Action";

/**
 * This reducer is used to manage the IDE view properties
 */
export function scriptsReducer (
  state: ScriptRunInfo[],
  { type, payload }: Action
): ScriptRunInfo[] {
  switch (type) {
    case "SET_SCRIPTS_STATUS":
      return (payload?.value as ScriptRunInfo[]).slice();
    default:
      return state;
  }
}
