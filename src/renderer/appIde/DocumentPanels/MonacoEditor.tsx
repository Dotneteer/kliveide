import Editor, { loader } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import AutoSizer from "../../../lib/react-virtualized-auto-sizer";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "../services/AppServicesProvider";
import { customLanguagesRegistry } from "@renderer/registry";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { isDebuggableCompilerOutput } from "@main/compiler-integration/compiler-registry";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { addBreakpoint, getBreakpoints, removeBreakpoint } from "../utils/breakpoint-utils";
import styles from "./MonacoEditor.module.scss";
import { refreshSourceCodeBreakpoints } from "@common/utils/breakpoints";
import { incBreakpointsVersionAction, incEditorVersionAction } from "@common/state/actions";
import { DocumentApi } from "@renderer/abstractions/DocumentApi";
import { useDocumentHubServiceVersion } from "../services/DocumentServiceProvider";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { getIsWindows } from "@renderer/os-utils";
import { useEmuApi } from "@renderer/core/EmuApi";
import { createEmuApi } from "@common/messaging/EmuApi";

let monacoInitialized = false;

// --- We use these shortcuts in this file for Monaco types
type Decoration = monacoEditor.editor.IModelDeltaDecoration;
type MarkdownString = monacoEditor.IMarkdownString;

// --- We need to invoke this function while initializing the app. This is required to
// --- render the Monaco editor with the supported language syntax highlighting.
export async function initializeMonaco(appPath: string) {
  loader.config({
    paths: {
      vs: `${appPath}/node_modules/monaco-editor/min/vs`
    }
  });
  const monaco = await loader.init();
  customLanguagesRegistry.forEach((entry) => ensureLanguage(monaco, entry.id));
  monacoInitialized = true;

  function ensureLanguage(monaco: typeof monacoEditor, language: string) {
    if (!monaco.languages.getLanguages().some(({ id }) => id === language)) {
      // --- Do we support that custom language?
      const languageInfo = customLanguagesRegistry.find((l) => l.id === language);
      if (languageInfo) {
        // --- Yes, register the new language
        monaco.languages.register({ id: languageInfo.id });

        // --- Register a tokens provider for the language
        monaco.languages.setMonarchTokensProvider(languageInfo.id, languageInfo.languageDef);

        // --- Set the editing configuration for the language
        monaco.languages.setLanguageConfiguration(languageInfo.id, languageInfo.options);

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

// --- This type represents the API that we can access from outside
export type EditorApi = DocumentApi & {
  setPosition(lineNo: number, column: number): void;
};

// --- Monaco editor component properties
type EditorProps = {
  document: ProjectDocumentState;
  value: string;
  apiLoaded?: (api: EditorApi) => void;
};

// --- This component wraps the Monaco editor
export const MonacoEditor = ({ document, value, apiLoaded }: EditorProps) => {
  // --- Monaco editor instance and related state variables
  const editor = useRef<monacoEditor.editor.IStandaloneCodeEditor>(null);

  // --- Recognize app theme changes and update Monaco editor theme accordingly
  const { theme } = useTheme();
  const [monacoTheme, setMonacoTheme] = useState("");

  // --- Respond to editor font size change requests
  const editorFontSize = useSelector((s) => s.ideViewOptions?.editorFontSize ?? 12);

  // --- We use these services to respond to various IDE events
  const { store, messenger } = useRendererContext();
  const { projectService } = useAppServices();
  const emuApi = useEmuApi();

  // --- Recognize if something changed in the current document hub
  const hubVersion = useDocumentHubServiceVersion();

  // --- Use these state variables to manage breakpoinst and their changes
  const breakpointsVersion = useSelector((s) => s.emulatorState.breakpointsVersion);
  const breakpoints = useRef<BreakpointInfo[]>([]);
  const compilation = useSelector((s) => s.compilation);
  const execState = useSelector((s) => s.emulatorState?.machineState);

  // --- Store Monaco editor decorations to display breakpoint information
  const oldDecorations = useRef<string[]>([]);
  const oldHoverDecorations = useRef<string[]>([]);
  const oldExecPointDecoration = useRef<string[]>([]);

  // --- The name of the resource this editor displays
  const resourceName = document.node?.projectPath;

  // --- The language to use with Monaco editor for syntax highlighting
  const languageInfo = customLanguagesRegistry.find((l) => l.id === document.language);

  // --- Recognize document actiovation to restore the previous document state
  const [activationVersion, setActivationVersion] = useState(0);

  // --- Focus on document activation
  useEffect(() => {
    requestAnimationFrame(() => {
      editor.current?.focus();
    });
  }, [activationVersion]);

  // --- Refresh breakpoints whenever the documentation hub is refreshed
  useLayoutEffect(() => {
    if (editor.current) {
      refreshBreakpoints();
      refreshCurrentBreakpoint();
    }
  }, [hubVersion]);

  // --- Respond to theme changes
  useEffect(() => {
    // --- Set the Monaco editor theme according to the document language
    const languageInfo = customLanguagesRegistry.find((l) => l.id === document.language);

    // --- Default theme name according to the Klive theme's tone
    let themeName = theme.tone === "light" ? "vs" : "vs-dark";
    if (
      (languageInfo?.lightTheme && theme.tone === "light") ||
      (languageInfo?.darkTheme && theme.tone === "dark")
    ) {
      // --- The custom language supports the current theme
      themeName = `${languageInfo.id}-${theme.tone}`;
    }
    setMonacoTheme(themeName);
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
  const onMount = (ed: monacoEditor.editor.IStandaloneCodeEditor, _: typeof monacoEditor): void => {
    // --- Restore the view state to display the editor is it has been left
    editor.current = ed;
    ed.setValue(value);

    // --- Mount events to save the view state
    const disposables: monacoEditor.IDisposable[] = [];
    disposables.push(
      ed.onMouseDown(handleEditorMouseDown),
      ed.onMouseLeave(handleEditorMouseLeave),
      ed.onMouseMove(handleEditorMouseMove)
    );

    // --- Create the API
    const editorApi: EditorApi = {
      // --- Before disposing the document, save its state
      beforeDocumentDisposal: async () => {
        if (document.savedVersionCount === document.editVersionCount) return;

        // --- Save the contents back to the document instance
        document.contents = editor.current.getModel()?.getValue();

        // --- Now, save it back to the file
        await projectService.saveFileContent(document.id, document.contents);
        document.savedVersionCount = document.editVersionCount;
        store.dispatch(incEditorVersionAction());
      },

      // --- Editor API specific
      setPosition: (lineNumber: number, column: number) => {
        ed.revealLineInCenter(lineNumber);
        ed.setPosition({ lineNumber, column });
        requestAnimationFrame(() => {
          ed.focus();
        });
      }
    };

    // --- Pass back the API so that the document ub service can use it
    apiLoaded?.(editorApi);

    // --- Dispose event handlers when the editor is about to dispose
    editor.current.onDidDispose(() => {
      disposables.forEach((d) => d.dispose());
    });

    // --- Show breakpoinst and other decorations when initially displaying the editor
    refreshBreakpoints();
    refreshCurrentBreakpoint();

    // --- Sign the document has been activated (again)
    setActivationVersion(activationVersion + 1);
  };

  // --- Handle document changes
  const onValueChanged = async (_: string, e: monacoEditor.editor.IModelContentChangedEvent) => {
    // --- Now, make this document permanent
    projectService.setPermanent(document.id);

    // --- Does the editor support breakpoints?
    if (languageInfo?.supportsBreakpoints) {
      // --- Keep track of breakpoint changes
      if (e.changes.length > 0) {
        // --- Get the text that has been deleted
        const change = e.changes[0];
        const deletedText = editor.current.getModel().getValueInRange(change.range);
        const deletedLines = (deletedText.match(new RegExp(e.eol, "g")) || []).length;

        // --- Have we deleted one or more EOLs?
        if (deletedLines > 0) {
          // --- Yes, scroll up breakpoints
          await createEmuApi(messenger).scrollBreakpoints(
            {
              resource: resourceName,
              line: change.range.startLineNumber
            },
            -deletedLines
          );
        }

        // --- Have we inserted one or more EOLs?
        const insertedLines = (change.text.match(new RegExp(e.eol, "g")) || []).length;
        if (insertedLines > 0) {
          // --- Yes, scroll down breakpoints.
          await createEmuApi(messenger).scrollBreakpoints(
            {
              resource: resourceName,
              line: change.range.startLineNumber + (change.range.startColumn === 1 ? 0 : 1)
            },
            insertedLines
          );
        }

        // --- If changed, normalize breakpoints
        await createEmuApi(messenger).normalizeBreakpoints(
          resourceName,
          editor.current.getModel()?.getLineCount() ?? -1
        );
      }
    }

    // --- Save the contents back to the document instance
    document.contents = editor.current.getModel()?.getValue();
    document.editVersionCount++;
    store.dispatch(incEditorVersionAction());

    // --- Now, save it back to the file
    await projectService.saveFileContentAsYouType(document.id, document.contents).then(
      () => {
        document.savedVersionCount = document.editVersionCount;
        store.dispatch(incEditorVersionAction());
      },
      (reason) => {
        if (reason !== "canceled") reportError(reason);
      }
    );
  };

  // --- render the editor when monaco has been initialized
  return monacoInitialized ? (
    <AutoSizer>
      {({ width, height }) => (
        <Editor
          options={{
            fontSize: editorFontSize,
            readOnly: document.isReadOnly,
            glyphMargin: languageInfo?.supportsBreakpoints
          }}
          loading=""
          width={width}
          height={height}
          key={document.id}
          language={document.language}
          theme={monacoTheme}
          value={value}
          path={document.id}
          keepCurrentModel={true}
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
  async function refreshBreakpoints(): Promise<void> {
    // --- Filter for source code breakpoint belonging to this resoure
    const state = store.getState();
    const bps = (breakpoints.current = await getBreakpoints(messenger));

    // --- Get the active compilation result
    const compilationResult = state?.compilation?.result;

    // --- Create the array of decorators
    const decorations: Decoration[] = [];
    const editorLines = editor.current?.getModel()?.getLineCount() ?? null;

    // --- Iterate through all breakpoins
    bps.forEach(async (bp) => {
      let unreachable = true;
      if (
        compilationResult?.errors?.length === 0 &&
        isDebuggableCompilerOutput(compilationResult)
      ) {
        // --- In case of a successful compilation, test if the breakpoint is allowed
        const sep = getIsWindows() ? "\\" : "/";
        const fileIndex = compilationResult.sourceFileList.findIndex((fi) =>
          fi.filename.replaceAll(sep, "/").endsWith(getResourceName())
        );
        if (fileIndex >= 0) {
          // --- We have address information for this source code file
          if (bp.resource) {
            // --- This is a source code breakpoint
            const bpInfo = compilationResult.listFileItems.find(
              (li) => li.fileIndex === fileIndex && li.lineNumber === bp.line
            );

            // --- Check if the breakpoint is reachable (a single label, for example, is not)
            unreachable = !bpInfo;
          } else if (bp.address != undefined) {
            // --- This is a binary breakpoint
            const bpInfo = compilationResult.sourceMap[bp.address];
            if (bpInfo) {
              if (bpInfo.fileIndex === fileIndex) {
                decorations.push(createBinaryBreakpointDecoration(bpInfo.line, bp.disabled));
              }
            }
          }
        }
      }

      // --- Render the breakpoint according to its type and reachability
      if (editorLines !== null) {
        if (bp.line <= editorLines) {
          let decoration: monacoEditor.editor.IModelDeltaDecoration;
          if (unreachable) {
            decoration = createUnreachableBreakpointDecoration(bp.line);
          } else {
            // --- Check if there is a binary breakpoint
            const binBp = bps.find((b) => b.address === bp.resolvedAddress);
            decoration = binBp
              ? createMixedBreakpointDecoration(bp.line, bp.disabled)
              : createCodeBreakpointDecoration(bp.line, bp.disabled);
          }
          decorations.push(decoration);
        } else if (bp.resource && bp.resource === document.node.projectPath) {
          // --- Remove the source code breakpoint exceeding the source code range
          await removeBreakpoint(messenger, bp);
        }
      }
    });

    oldDecorations.current = editor.current.deltaDecorations(oldDecorations.current, decorations);
  }

  /**
   * Handles the editor's mousemove event
   * @param e
   */
  function handleEditorMouseMove(e: monacoEditor.editor.IEditorMouseEvent): void {
    if (e.target?.type === 2) {
      // --- Mouse is over the margin, display the breakpoint placeholder
      const lineNo = e.target.position.lineNumber;
      const existingBp = breakpoints.current.find(
        (bp) => bp.resource === resourceName && bp.line === lineNo
      );
      const message = `Click to ${existingBp ? "remove the existing" : "add a new"} breakpoint`;
      oldHoverDecorations.current = editor.current.deltaDecorations(oldHoverDecorations.current, [
        createHoverBreakpointDecoration(lineNo, message)
      ]);
    } else {
      // --- Mouse is out of margin, remove the breakpoint placeholder
      editor.current.deltaDecorations(oldHoverDecorations.current, []);
    }
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  function handleEditorMouseLeave(_e: monacoEditor.editor.IEditorMouseEvent): void {
    editor.current.deltaDecorations(oldHoverDecorations.current, []);
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  function handleEditorMouseDown(e: monacoEditor.editor.IEditorMouseEvent): void {
    if (e.event.leftButton && e.target?.type === 2) {
      // --- Breakpoint glyph is clicked
      const lineNo = e.target.position.lineNumber;
      const existingBp = breakpoints.current.find(
        (bp) => bp.resource === document.node?.projectPath && bp.line === lineNo
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
  function getResourceName(): string {
    const projPath = store.getState().project.folderPath;
    return document.id.substring(projPath.length);
  }

  /**
   * Refreshes the current breakpoint
   * @returns
   */
  async function refreshCurrentBreakpoint(): Promise<void> {
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
    const cpuStateResponse = await emuApi.getCpuState();
    const pc = cpuStateResponse.pc;

    // --- Does this file contains the default breakpoint?
    const sep = getIsWindows() ? "\\" : "/";
    const fileIndex = compilation.result.sourceFileList.findIndex((fi) =>
      fi.filename.replaceAll(sep, "/").endsWith(getResourceName())
    );
    if (fileIndex >= 0) {
      // --- We have address information for this source code file
      const lineInfo = compilation.result.listFileItems.find(
        (li) => li.fileIndex === fileIndex && li.address === pc
      );

      // --- Get source map information
      const sourceMapInfo = compilation.result.sourceMap[pc];
      if (lineInfo) {
        oldExecPointDecoration.current = editor.current.deltaDecorations(
          oldExecPointDecoration.current,
          [
            createCurrentBreakpointDecoration(
              languageInfo.fullLineBreakpoints,
              lineInfo.lineNumber,
              sourceMapInfo?.startColumn,
              sourceMapInfo?.endColumn
            )
          ]
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
function createCodeBreakpointDecoration(lineNo: number, disabled: boolean): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: disabled ? styles.disabledBreakpointMargin : styles.codeBreakpointMargin
    }
  };
}

/**
 * Creates a binary breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createBinaryBreakpointDecoration(lineNo: number, disabled: boolean): Decoration {
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
function createMixedBreakpointDecoration(lineNo: number, disabled: boolean): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: true,
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
function createHoverBreakpointDecoration(lineNo: number, message?: string): Decoration {
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
function createUnreachableBreakpointDecoration(lineNo: number): Decoration {
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
function createCurrentBreakpointDecoration(
  fullLine: boolean,
  lineNo: number,
  startColumn?: number,
  endColumn?: number
): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, startColumn ?? 1, lineNo, (endColumn ?? 1) + 1),
    options: {
      isWholeLine: fullLine,
      className: styles.activeBreakpointLine,
      glyphMarginClassName: styles.activeBreakpointMargin
    }
  };
}
