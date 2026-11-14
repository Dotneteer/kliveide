// ====================================================================================================================
// Which IDE renderer each `IdeApi` method goes to (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.3).
//
// With floating document windows there is more than one IDE renderer: the IDE window and up to eight
// satellites. Every method is classified here, once; `test/messaging/ide-api-routing.test.ts` fails
// when a method is added to `IdeApi` without a class.
// ====================================================================================================================

import type { IdeApi } from "./IdeApi";
import { TargetWindowUnavailableError } from "./messages-core";

/**
 * How an `IdeApi` call is delivered
 * - `broadcast`: the IDE and every floating window
 * - `document`: the window that holds the document the call is about, else the IDE
 * - `ide`: the IDE only (output, dialogs, commands, project structure)
 * - `fanout`: every floating window first, then the IDE; `false` from any of them wins
 * - `float`: only the floating window addressed (it makes no sense for the IDE)
 */
export type IdeApiRouting = "broadcast" | "document" | "ide" | "fanout" | "float";

type IdeApiMethodName = {
  [K in keyof IdeApi]: IdeApi[K] extends (...args: any[]) => any ? K : never;
}[keyof IdeApi];

/**
 * The routing class of every `IdeApi` method
 */
export const IDE_API_ROUTING: Record<IdeApiMethodName, IdeApiRouting> = {
  displayOutput: "ide",
  displayOutputBatch: "ide",
  scriptOutput: "ide",
  scriptOutputBatch: "ide",
  showMemory: "document",
  showDisassembly: "document",
  showBasic: "document",
  displayDialog: "ide",
  executeCommand: "ide",
  executeCommandCaptured: "ide",
  saveAllBeforeQuit: "fanout",
  annotationFileChanged: "broadcast",
  diskImageChanged: "broadcast",
  getProjectStructure: "ide",
  fileContentChanged: "broadcast",
  openDockedDocument: "ide",
  revealFloatingDocument: "float",
  floatingDocumentRenamed: "float",
  requestFloatingClose: "float",
  recordNavigation: "ide",
  stepNavigation: "ide",
  setNavigationOrigin: "ide",
  restoreNavigation: "float"
};

/**
 * Combines the answers of a fan-out call: `false` from any renderer stops the operation (a quit).
 * A window that no longer exists has nothing left to save and does not stop it; any other failure
 * does, because going on could lose that window's edits.
 */
export function combineFanoutResults(results: PromiseSettledResult<boolean | undefined>[]): boolean {
  return results.every((result) =>
    result.status === "fulfilled"
      ? result.value !== false
      : result.reason instanceof TargetWindowUnavailableError
  );
}
