import type { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import type { EvaluationContext } from "./EvaluationContext";
import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";

import type { OutputSpecification } from "@renderer/appIde/ToolArea/abstractions";

import { setScriptsStatusAction } from "@common/state/actions";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { PANE_ID_SCRIPTIMG } from "@common/integration/constants";
import { createIdeApi } from "@common/messaging/IdeApi";

/**
 * Styling a single line of script output may carry.
 *
 * These are the presentation fields of an output span — `foreground` above all — minus
 * the ones `sendScriptOutput` fills in itself. The type is deliberately narrow: while
 * this was `Record<string, any>`, thirteen call sites passed a `color` field that
 * nothing downstream reads, so every script message silently rendered in the default
 * cyan and errors were indistinguishable from successes.
 */
export type ScriptOutputOptions = Partial<Omit<OutputSpecification, "pane" | "text">>;

/**
 * Concludes a running script and handles the UI messages related to it
 * @param store State store
 * @param execTask Running script task
 * @param evalContext Script evaluation context
 * @param getAllScriptsFn A function that retrieves all scripts
 * @param script The script to conclude
 * @param outputFn Function to output messages
 * @param cleanupFn Function to clean up the script
 */
export function concludeScript(
  store: Store<AppState>,
  execTask: Promise<void>,
  evalContext: EvaluationContext,
  getAllScriptsFn: () => ScriptRunInfo[],
  script: ScriptRunInfo,
  outputFn?: (text: string, options?: ScriptOutputOptions) => Promise<void>,
  cleanupFn?: () => void
): void {
  (async () => {
    try {
      await execTask;
      const cancelled = evalContext.cancellationToken!.cancelled;
      script.status = cancelled ? "stopped" : "completed";
      let time = 0;
      if (cancelled) {
        script.stopTime = new Date();
        time = script.stopTime.getTime() - script.startTime.getTime();
      } else {
        script.endTime = new Date();
        time = script.endTime.getTime() - script.startTime.getTime();
      }
      outputFn?.(
        `Script ${script.scriptFileName} with ID ${script.id} ${script.status} after ${time}ms.`,
        {
          foreground: cancelled ? "yellow" : "green"
        }
      );
    } catch (error: any) {
      script.status = "execError";
      script.error = error.message;
      script.endTime = new Date();
      const time = script.endTime.getTime() - script.startTime.getTime();
      outputFn?.(`Script ${script.scriptFileName} with ID ${script.id} failed in ${time}ms.`, {
        foreground: "red"
      });
      outputFn?.(error.toString?.() ?? "Unknown error", {
        foreground: "bright-red"
      });
      throw error;
    } finally {
      // --- Update the script status
      cleanupFn?.();
      store.dispatch(setScriptsStatusAction(getAllScriptsFn()));
    }
  })();
}

/**
 * Sends the output of a script to the IDE
 * @param text Text to send
 * @param options Additional options
 */
export async function sendScriptOutput(
  messenger: MessengerBase,
  text: string,
  options?: ScriptOutputOptions
): Promise<void> {
  createIdeApi(messenger).displayOutput({
    pane: PANE_ID_SCRIPTIMG,
    text,
    foreground: "cyan",
    writeLine: true,
    ...options
  });
}
