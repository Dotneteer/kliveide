import { OutputSpecification } from "@renderer/appIde/ToolArea/abstractions";
import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import { ProjectStructure } from "@main/ksx-runner/ProjectStructure";
import type { MessageSource } from "./messages-core";
import type { NavigationEntry } from "@renderer/abstractions/NavigationLocation";
import type {
  DockedDocumentRequest,
  FloatingDocumentReveal
} from "./floating-documents";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

/**
 * Abstract base class defining the shape of the IDE process API that can be called from
 * the Emu and main processes. The methods are called through a JavaScript proxy and must
 * be implemented by a proxy handler. Do not instantiate directly.
 */
abstract class IdeApiImpl {
  /**
   * Displays output in the IDE output pane.
   * @param _toDisplay Output specification to display.
   */
  async displayOutput(_toDisplay: OutputSpecification): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Displays several output spans in one round trip.
   *
   * Every call on this API is an awaited, correlated request with its own timeout entry, so the
   * cost of console output was dominated by the *number* of messages rather than their size: one
   * per span, and the style re-sent in full with each. Emitting a run of spans as one message is
   * the difference between two round trips per emulator log line and one.
   *
   * @param _toDisplay Output specifications, applied in order.
   */
  async displayOutputBatch(_toDisplay: OutputSpecification[]): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sends script output to the IDE.
   * @param _id Script ID.
   * @param _operation Buffer operation to perform.
   * @param _args Optional arguments for the operation.
   */
  async scriptOutput(_id: number, _operation: any, _args?: any[]): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sends a run of script-output operations in one round trip.
   *
   * Script output carries *stateful* style, so a single coloured line is `pushStyle`, `resetStyle`,
   * `color`, `write`, `write`, `writeLine`, `popStyle` — seven serial awaited round trips for one
   * line of text. As one message it is one.
   *
   * @param _id Script ID.
   * @param _operations Buffer operations, applied in order.
   */
  async scriptOutputBatch(
    _id: number,
    _operations: { operation: any; args?: any[] }[]
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Shows or hides the memory panel.
   * @param _show True to show, false to hide.
   */
  async showMemory(_show: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Shows or hides the disassembly panel.
   * @param _show True to show, false to hide.
   */
  async showDisassembly(_show: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Shows or hides the BASIC listing panel.
   * @param _show True to show, false to hide.
   */
  async showBasic(_show: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Displays a registered IDE dialog.
   * @param _dialogId Numeric dialog ID.
   * @param _dialogData Optional dialog payload.
   */
  async displayDialog(_dialogId: number, _dialogData?: any): Promise<unknown | undefined> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Executes a command in the IDE.
   * @param _commandText The command text to execute.
   * @param _scriptId Optional script ID for script context.
   */
  async executeCommand(
    _commandText: string,
    _scriptId?: number
  ): Promise<IdeCommandResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Executes a command into a fresh output buffer, mirrored to the Build pane, and returns its
   * output as plain text lines with the result (`dev/plans/COMMAND_LINE_AUTOMATION_PLAN.md` D9).
   * With `automation`, a command marked `automation: "deny"` is refused instead of run (T5).
   * @param _commandText The command text to execute.
   * @param _options Options of the run.
   */
  async executeCommandCaptured(
    _commandText: string,
    _options?: { automation?: boolean }
  ): Promise<CapturedCommandResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Saves all files before quitting the IDE.
   */
  async saveAllBeforeQuit(): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * An annotation sidecar followed with `MainApi.watchAnnotationFile` changed on disk. The IDE
   * re-reads it into its annotation session unless the file holds what the session already has.
   * @param _filePath The sidecar's absolute path
   */
  async annotationFileChanged(_filePath: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * The machine wrote to a disk image file (dev/plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, D4): a Disk
   * Explorer showing it reloads
   * @param _filePath The image's absolute path
   */
  async diskImageChanged(_filePath: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current project structure.
   */
  async getProjectStructure(): Promise<ProjectStructure> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * A renderer saved a file: the others drop it from their file-content cache
   * (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.5).
   * @param _filePath The saved file's path
   */
  async fileContentChanged(_filePath: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Opens a document coming back from a floating window (Dock) in the IDE (plan §3.4).
   * @param _request The document and the area it came from
   */
  async openDockedDocument(_request: DockedDocumentRequest): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * A floating window: moves the view of its document to a position (opening a floating document
   * elsewhere focuses its window and navigates there, plan §2.3).
   * @param _reveal Where to go
   */
  async revealFloatingDocument(_reveal: FloatingDocumentReveal): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * A floating window: the file of its document was renamed in the Explorer.
   * @param _oldId The document's old ID (path)
   * @param _newId The document's new ID (path)
   */
  async floatingDocumentRenamed(_oldId: string, _newId: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * A floating window: the OS asked to close it (Alt+F4, Cmd+W). It runs the same path as its
   * Close button (plan Q4): saves, the prompts for unsaved documents, then main destroys it.
   */
  async requestFloatingClose(): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Records a jump a floating window made in the IDE's navigation history (one history, owned by the
   * IDE: FLOATING_DOCUMENT_WINDOWS_PLAN §3.5).
   * @param _from Where the jump started
   * @param _to Where it ended
   */
  async recordNavigation(_from?: NavigationEntry, _to?: NavigationEntry): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Steps the IDE's navigation history from a floating window's current location.
   * @param _direction -1: Go Back, 1: Go Forward
   * @param _current Where the floating window is now
   */
  async stepNavigation(
    _direction: -1 | 1,
    _current?: NavigationEntry
  ): Promise<NavigationStepResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * The next jump the IDE records starts at this location in a floating window (a `nav` from there to
   * another document runs in the IDE).
   * @param _origin The floating window's location
   */
  async setNavigationOrigin(_origin?: NavigationEntry): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * A floating window: restores a location of its own document that the IDE's history steps to.
   * @param _entry The location
   */
  async restoreNavigation(_entry: NavigationEntry): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }
}

/** What a step of the navigation history did */
export type NavigationStepResult = {
  /** The history moved */
  moved: boolean;
  /** The document now current in the IDE (main brings the IDE forward unless it floats) */
  documentId?: string;
};

/** A command's result with its output (`executeCommandCaptured`) */
export type CapturedCommandResult = IdeCommandResult & {
  /** The command's output, colours stripped, one string per line */
  output: string[];
  /** The command is not allowed through automation (T5); it did not run */
  denied?: boolean;
};

// Internal concrete subclass for proxy instantiation
class ProxyIdeApiImpl extends IdeApiImpl {}

export type IdeApi = IdeApiImpl;

/**
 * IDE-process methods whose duration is genuinely unbounded, and which therefore opt out of the
 * default request timeout.
 */
const UNBOUNDED_IDE_METHODS = [
  // --- Blocks until the user responds
  "displayDialog",
  // --- Runs an arbitrary IDE command, which may itself build or run a project
  "executeCommand",
  "executeCommandCaptured",
  // --- Saves every dirty document on the quit path
  "saveAllBeforeQuit",
  // --- May ask the user about unsaved documents
  "requestFloatingClose"
] as const;

/**
 * The names of every method of the IDE API (the routing table's test reads them)
 */
export function getIdeApiMethodNames(): string[] {
  return Object.getOwnPropertyNames(IdeApiImpl.prototype).filter((name) => name !== "constructor");
}

/**
 * Creates the IDE API proxy over a messenger
 * @param messenger The messenger to the IDE renderer
 * @param targetId The renderer the requests go to: the IDE, or a floating window
 */
export function createIdeApi(messenger: MessengerBase, targetId: MessageSource = "ide"): IdeApiImpl {
  return buildMessagingProxy(new ProxyIdeApiImpl(), messenger, targetId, {
    unboundedMethods: UNBOUNDED_IDE_METHODS
  });
}
