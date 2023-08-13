import Editor, { loader } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import AutoSizer from "../../../lib/react-virtualized-auto-sizer";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { CodeDocumentState } from "../services/DocumentService";
import { useAppServices } from "../services/AppServicesProvider";
import { customLanguagesRegistry } from "@renderer/registry";
import { DocumentInfo } from "@abstractions/DocumentInfo";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { isDebuggableCompilerOutput } from "@main/compiler-integration/compiler-registry";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import {
  addBreakpoint,
  getBreakpoints,
  removeBreakpoint
} from "../utils/breakpoint-utils";
import styles from "./MonacoEditor.module.scss";
import { refreshSourceCodeBreakpoints } from "@common/utils/breakpoints";
import { incBreakpointsVersionAction } from "@common/state/actions";

// --- Wait 1000 ms before saving the document being edited
const SAVE_DEBOUNCE = 1000;

let monacoInitialized = false;

type Decoration = monacoEditor.editor.IModelDeltaDecoration;
type MarkdownString = monacoEditor.IMarkdownString;

export async function initializeMonaco (appPath: string) {
  loader.config({
    paths: {
      vs: `${appPath}/node_modules/monaco-editor/min/vs`
    }
  });
  const monaco = await loader.init();
  customLanguagesRegistry.forEach(entry => ensureLanguage(monaco, entry.id));
  monacoInitialized = true;

  function ensureLanguage (monaco: typeof monacoEditor, language: string) {
    if (!monaco.languages.getLanguages().some(({ id }) => id === language)) {
      // --- Do we support that custom language?
      const languageInfo = customLanguagesRegistry.find(l => l.id === language);
      if (languageInfo) {
        // --- Yes, register the new language
        monaco.languages.register({ id: languageInfo.id });

        // --- Register a tokens provider for the language
        monaco.languages.setMonarchTokensProvider(
          languageInfo.id,
          languageInfo.languageDef
        );

        // --- Set the editing configuration for the language
        monaco.languages.setLanguageConfiguration(
          languageInfo.id,
          languageInfo.options
        );

        // --- Define light theme for the language
        if (languageInfo.lightTheme) {
          monaco.editor.defineTheme(`${languageInfo.id}-light`, {
            base: "vs",
            inherit: true,
            rules: languageInfo.lightTheme.rules,
            encodedTokensColors: languageInfo.lightTheme.encodedTokensColors,
            colors: languageInfo.lightTheme.colors
          });
        }
        // --- Define dark theme for the language
        if (languageInfo.darkTheme) {
          monaco.editor.defineTheme(`${languageInfo.id}-dark`, {
            base: "vs-dark",
            inherit: true,
            rules: languageInfo.darkTheme.rules,
            encodedTokensColors: languageInfo.darkTheme.encodedTokensColors,
            colors: languageInfo.darkTheme.colors
          });
        }
        if (languageInfo.depensOn) {
          for (const dependOn of languageInfo.depensOn) {
            ensureLanguage(monaco, dependOn);
          }
        }
      }
    }
  }
}

export interface EditorApi {
  setPosition(lineNo: number, column: number): void;
}

type EditorProps = {
  document: DocumentInfo;
  value: string;
  viewState?: monacoEditor.editor.ICodeEditorViewState;
  apiLoaded?: (api: EditorApi) => void;
};

export const MonacoEditor = ({
  document,
  value,
  viewState,
  apiLoaded
}: EditorProps) => {
  const { theme } = useTheme();
  const { store, messenger } = useRendererContext();
  const { documentService } = useAppServices();
  const [vsTheme, setVsTheme] = useState("");
  const editor = useRef<monacoEditor.editor.IStandaloneCodeEditor>(null);
  const monaco = useRef<typeof monacoEditor>(null);
  const docActivationVersion = useSelector(
    s => s.ideView?.documentActivationVersion
  );
  const previousContent = useRef<string>();
  const unsavedChangeCounter = useRef(0);
  const editorFontSize = useSelector(
    s => s.ideViewOptions?.editorFontSize ?? 12
  );

  const breakpointsVersion = useSelector(
    s => s.emulatorState.breakpointsVersion
  );
  const breakpoints = useRef<BreakpointInfo[]>([]);
  const compilation = useSelector(s => s.compilation);
  const execState = useSelector(s => s.emulatorState?.machineState);

  const oldDecorations = useRef<string[]>([]);
  const oldHoverDecorations = useRef<string[]>([]);
  const oldExecPointDecoration = useRef<string[]>([]);

  const resourceName = document.node?.data?.projectPath;
  const languageInfo = customLanguagesRegistry.find(
    l => l.id === document.language
  );

  // --- Set the editor focus, whenever the activation version changes
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      editor.current?.focus();
    });
    if (editor.current) {
      refreshBreakpoints();
      refreshCurrentBreakpoint();
    }
  }, [docActivationVersion]);

  // --- Respond to theme changes
  useEffect(() => {
    // --- Set the theme according to the document language
    const languageInfo = customLanguagesRegistry.find(
      l => l.id === document.language
    );
    let themeName = theme.tone === "light" ? "vs" : "vs-dark";
    if (
      (languageInfo?.lightTheme && theme.tone === "light") ||
      (languageInfo?.darkTheme && theme.tone === "dark")
    ) {
      themeName = `${languageInfo.id}-${theme.tone}`;
    }
    setVsTheme(themeName);
  }, [theme, document.language]);

  // --- Respond to editor font size changes
  useEffect(() => {
    editor.current;
  }, [editorFontSize]);

  // --- Refresh breakpoints when they may change
  useEffect(() => {
    if (editor.current) {
      refreshBreakpoints();
      refreshCurrentBreakpoint();
    }
  }, [breakpointsVersion, compilation, execState]);

  // --- Initializes the editor when mounted
  const onMount = (
    ed: monacoEditor.editor.IStandaloneCodeEditor,
    mon: typeof monacoEditor
  ): void => {
    editor.current = ed;
    monaco.current = mon;
    if (viewState) {
      ed.restoreViewState(viewState);
    }

    // --- Mount events to save the view state
    const disposables: monacoEditor.IDisposable[] = [];
    disposables.push(
      ed.onDidBlurEditorText(saveDocumentState),
      ed.onDidBlurEditorWidget(saveDocumentState),
      ed.onDidChangeCursorPosition(saveDocumentState),
      ed.onDidChangeCursorSelection(saveDocumentState),
      ed.onDidChangeHiddenAreas(saveDocumentState),
      ed.onDidFocusEditorText(saveDocumentState),
      ed.onDidFocusEditorWidget(saveDocumentState),
      ed.onMouseDown(handleEditorMouseDown),
      ed.onMouseLeave(handleEditorMouseLeave),
      ed.onMouseMove(handleEditorMouseMove)
    );

    // --- Create the API
    const editorApi: EditorApi = {
      setPosition: (lineNumber: number, column: number) => {
        ed.revealLineInCenter(lineNumber);
        ed.setPosition({ lineNumber, column });
        requestAnimationFrame(() => {
          ed.focus();
        });
      }
    };
    apiLoaded?.(editorApi);

    // --- Dispose event handlers
    editor.current.onDidDispose(() => {
      disposables.forEach(d => d.dispose());
    });

    refreshBreakpoints();
    refreshCurrentBreakpoint();
  };

  // --- Saves the document state
  const saveDocumentState = () => {
    const data: CodeDocumentState = {
      value: editor.current.getValue(),
      viewState: editor.current.saveViewState()
    };
    documentService.setDocumentData(document.id, data);
  };

  // Saves the document to its file
  const saveDocumentToFile = async (documentText: string): Promise<void> => {
    const response = await messenger.sendMessage({
      type: "MainSaveTextFile",
      path: document.id,
      data: documentText
    });
    if (response.type === "ErrorResponse") {
      reportMessagingError(
        `Errors saving code file '${document.id}': ${response.message}`
      );
    }
  };

  // --- Handle document changes
  const onValueChanged = async (
    val: string,
    e: monacoEditor.editor.IModelContentChangedEvent
  ) => {
    // --- Now, make this document permanent
    documentService.setPermanent(document.id);

    // --- Save the current value as the previous one
    previousContent.current = editor.current.getValue();

    // --- Does the editor support breakpoints?
    if (languageInfo?.supportsBreakpoints) {
      // --- Keep track of breakpoint changes
      if (e.changes.length > 0) {
        // --- Get the text that has been deleted
        const change = e.changes[0];
        const deletedText = monacoEditor.editor
          .createModel(previousContent.current)
          .getValueInRange(change.range);
        const deletedLines = (deletedText.match(new RegExp(e.eol, "g")) || [])
          .length;

        // --- Have we deleted one or more EOLs?
        if (deletedLines > 0) {
          // --- Yes, scroll up breakpoints
          const response = await messenger.sendMessage({
            type: "EmuScrollBreakpoints",
            addr: {
              resource: resourceName,
              line: change.range.startLineNumber + deletedLines
            },
            shift: -deletedLines
          });
          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `EmuScrollBreakpoints call failed: ${response.message}`
            );
          }
        }

        // --- Have we inserted one or more EOLs?
        const insertedLines = (change.text.match(new RegExp(e.eol, "g")) || [])
          .length;
        if (insertedLines > 0) {
          // --- Yes, scroll down breakpoints.
          const response = await messenger.sendMessage({
            type: "EmuScrollBreakpoints",
            addr: {
              resource: resourceName,
              line:
                change.range.startLineNumber +
                (change.range.startColumn === 1 ? 0 : 1)
            },
            shift: insertedLines
          });
          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `EmuScrollBreakpoints call failed: ${response.message}`
            );
          }
        }

        // --- If changed, normalize breakpoints
        const response = await messenger.sendMessage({
          type: "EmuNormalizeBreakpoints",
          resource: resourceName,
          lineCount: editor.current.getModel().getLineCount()
        });
        if (response.type === "ErrorResponse") {
          reportMessagingError(
            `EmuNormalizeBreakpoints call failed: ${response.message}`
          );
        }
      }
    }

    // --- Save document after the change (with delay)
    unsavedChangeCounter.current++;
    await new Promise(r => setTimeout(r, SAVE_DEBOUNCE));
    if (unsavedChangeCounter.current === 1 && previousContent.current) {
      await saveDocumentToFile(editor.current.getModel().getValue());
    }
    unsavedChangeCounter.current--;
  };

  return monacoInitialized ? (
    <AutoSizer>
      {({ width, height }) => (
        <Editor
          options={{
            fontSize: editorFontSize,
            readOnly: document.isReadOnly,
            glyphMargin: languageInfo.supportsBreakpoints
          }}
          loading=''
          width={width}
          height={height}
          key={document.id}
          language={document.language}
          theme={vsTheme}
          value={value}
          onMount={onMount}
          onChange={onValueChanged}
        />
      )}
    </AutoSizer>
  ) : null;

  /**
   * Takes care that the editor's breakpoint decorations are updated
   * @param breakpoints Current breakpoints
   * @param compilation Current compilations
   */
  async function refreshBreakpoints (): Promise<void> {
    // --- Filter for source code breakpoint belonging to this resoure
    const state = store.getState();
    const bps = (breakpoints.current = await getBreakpoints(messenger));

    // --- Get the active compilation result
    const compilationResult = state?.compilation?.result;

    // --- Create the array of decorators
    const decorations: Decoration[] = [];
    const editorLines = editor.current.getModel().getLineCount();

    // --- Iterate through all breakpoins
    bps.forEach(async bp => {
      let unreachable = true;
      if (
        compilationResult?.errors?.length === 0 &&
        isDebuggableCompilerOutput(compilationResult)
      ) {
        // --- In case of a successful compilation, test if the breakpoint is allowed
        const fileIndex = compilationResult.sourceFileList.findIndex(fi =>
          fi.filename.endsWith(getResourceName())
        );
        if (fileIndex >= 0) {
          // --- We have address information for this source code file
          if (bp.resource) {
            // --- This is a source code breakpoint
            const bpInfo = compilationResult.listFileItems.find(
              li => li.fileIndex === fileIndex && li.lineNumber === bp.line
            );

            // --- Check if the breakpoint is reachable (a single label, for example, is not)
            unreachable = !bpInfo;
          } else if (bp.address != undefined) {
            // --- This is a binary breakpoint
            const bpInfo = compilationResult.sourceMap[bp.address];
            if (bpInfo) {
              if (bpInfo.fileIndex === fileIndex) {
                decorations.push(
                  createBinaryBreakpointDecoration(bpInfo.line, bp.disabled)
                );
              }
            }
          }
        }
      }

      // --- Render the breakpoint according to its type and reachability
      if (bp.line <= editorLines) {
        let decoration: monacoEditor.editor.IModelDeltaDecoration;
        if (unreachable) {
          decoration = createUnreachableBreakpointDecoration(bp.line);
        } else {
          // --- Check if there is a binary breakpoint
          const binBp = bps.find(b => b.address === bp.resolvedAddress);
          decoration = binBp
            ? createMixedBreakpointDecoration(bp.line, bp.disabled)
            : createCodeBreakpointDecoration(bp.line, bp.disabled);
        }
        decorations.push(decoration);
      } else if (bp.resource) {
        // --- Remove the source code breakpoint exceeding the source code range
        await removeBreakpoint(messenger, bp);
      }
    });
    oldDecorations.current = editor.current.deltaDecorations(
      oldDecorations.current,
      decorations
    );
  }

  /**
   * Handles the editor's mousemove event
   * @param e
   */
  function handleEditorMouseMove (
    e: monacoEditor.editor.IEditorMouseEvent
  ): void {
    if (e.target?.type === 2) {
      // --- Mouse is over the margin, display the breakpoint placeholder
      const lineNo = e.target.position.lineNumber;
      const existingBp = breakpoints.current.find(
        bp => bp.resource === resourceName && bp.line === lineNo
      );
      const message = `Click to ${
        existingBp ? "remove the existing" : "add a new"
      } breakpoint`;
      oldHoverDecorations.current = editor.current.deltaDecorations(
        oldHoverDecorations.current,
        [createHoverBreakpointDecoration(lineNo, message)]
      );
    } else {
      // --- Mouse is out of margin, remove the breakpoint placeholder
      editor.current.deltaDecorations(oldHoverDecorations.current, []);
    }
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  function handleEditorMouseLeave (
    e: monacoEditor.editor.IEditorMouseEvent
  ): void {
    editor.current.deltaDecorations(oldHoverDecorations.current, []);
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  function handleEditorMouseDown (
    e: monacoEditor.editor.IEditorMouseEvent
  ): void {
    if (e.event.leftButton && e.target?.type === 2) {
      // --- Breakpoint glyph is clicked
      const lineNo = e.target.position.lineNumber;
      const existingBp = breakpoints.current.find(
        bp =>
          bp.resource === document.node?.data?.projectPath && bp.line === lineNo
      );
      (async () => {
        if (existingBp) {
          await removeBreakpoint(messenger, existingBp);
        } else {
          await addBreakpoint(messenger, {
            resource: resourceName,
            line: lineNo,
            exec: true
          });
          await refreshSourceCodeBreakpoints(store, messenger);
          store.dispatch(incBreakpointsVersionAction());
        }
        handleEditorMouseLeave(e);
      })();
    }
  }

  /**
   * Gets the resource name of this document
   */
  function getResourceName (): string {
    const projPath = store.getState().project.folderPath;
    return document.id.substring(projPath.length);
  }

  /**
   * Refreshes the current breakpoint
   * @returns
   */
  async function refreshCurrentBreakpoint (): Promise<void> {
    if (!editor.current) {
      return;
    }

    // --- Refresh the information only during paused state
    if (
      execState !== MachineControllerState.Paused ||
      !compilation.result ||
      compilation.failed ||
      compilation.result.errors.length > 0
    ) {
      oldExecPointDecoration.current = editor.current.deltaDecorations(
        oldExecPointDecoration.current,
        []
      );
      return;
    }

    if (!isDebuggableCompilerOutput(compilation.result)) {
      return;
    }

    // --- Get the current PC value
    const cpuStateResponse = await messenger.sendMessage({
      type: "EmuGetCpuState"
    });
    let pc = -1;
    if (cpuStateResponse.type === "ErrorResponse") {
      reportError(`EmuGetCpuState call failed: ${cpuStateResponse.message}`);
    } else if (cpuStateResponse.type !== "EmuGetCpuStateResponse") {
      reportUnexpectedMessageType(cpuStateResponse.type);
    } else {
      pc = cpuStateResponse.pc;
    }

    // --- Does this file contains the default breakpoint?
    const fileIndex = compilation.result.sourceFileList.findIndex(fi =>
      fi.filename.endsWith(getResourceName())
    );
    if (fileIndex >= 0) {
      // --- We have address information for this source code file
      const lineInfo = compilation.result.listFileItems.find(
        li => li.fileIndex === fileIndex && li.address === pc
      );
      if (lineInfo) {
        oldExecPointDecoration.current = editor.current.deltaDecorations(
          oldExecPointDecoration.current,
          [createCurrentBreakpointDecoration(lineInfo.lineNumber)]
        );
      }
      return;
    }
    oldExecPointDecoration.current = editor.current.deltaDecorations(
      oldExecPointDecoration.current,
      []
    );
  }
};

/**
 * Creates a code breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createCodeBreakpointDecoration (
  lineNo: number,
  disabled: boolean
): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: disabled
        ? styles.disabledBreakpointMargin
        : styles.codeBreakpointMargin
    }
  };
}

/**
 * Creates a binary breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createBinaryBreakpointDecoration (
  lineNo: number,
  disabled: boolean
): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: disabled
        ? styles.disabledBreakpointMargin
        : styles.binaryBreakpointMargin
    }
  };
}

/**
 * Creates a mixed breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createMixedBreakpointDecoration (
  lineNo: number,
  disabled: boolean
): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: disabled
        ? styles.disabledBreakpointMargin
        : styles.mixedBreakpointMargin
    }
  };
}

/**
 * Creates a breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createHoverBreakpointDecoration (
  lineNo: number,
  message?: string
): Decoration {
  const hoverMessage: MarkdownString = message ? { value: message } : null;
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: styles.hoverBreakpointMargin,
      glyphMarginHoverMessage: hoverMessage
    }
  };
}

/**
 * Creates an unreachable breakpoint decoration
 * @param lineNo Line to apply the decoration to
 * @returns
 */
function createUnreachableBreakpointDecoration (lineNo: number): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: styles.unreachableBreakpointMargin
    }
  };
}

/**
 * Creates a current breakpoint decoration
 * @param lineNo Line to apply the decoration to
 * @returns
 */
function createCurrentBreakpointDecoration (lineNo: number): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: true,
      className: styles.activeBreakpointLine,
      glyphMarginClassName: styles.activeBreakpointMargin
    }
  };
}
