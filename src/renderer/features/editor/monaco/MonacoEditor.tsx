import Editor from "@monaco-editor/react";
import { useCoverageDecorations, type CoverageClasses } from "@renderer/features/coverage/useCoverageDecorations";
import { DEFAULT_ACCENT, isAccentId, type AccentId } from "@common/theming/accents";
import * as monacoEditor from "monaco-editor";
import AutoSizer from "../../../../lib/react-virtualized-auto-sizer";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { useEffect, useRef, useState } from "react";
import { getGlobalSetting, useGlobalSetting, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { selectedZxBasicCompiler } from "@main/zxb-integration/zxb-config";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { customLanguagesRegistry } from "@renderer/registry";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import { addBreakpoint, getBreakpoints, removeBreakpoint } from "@renderer/appIde/utils/breakpoint-utils";
import styles from "./MonacoEditor.module.scss";

/** The coverage strip's classes (stable, so the coverage hook does not re-run for them) */
const COVERAGE_CLASSES: CoverageClasses = {
  covered: styles.coverageCovered,
  partial: styles.coveragePartial,
  uncovered: styles.coverageUncovered,
  lineTint: styles.coverageLine
};
import { refreshSourceCodeBreakpoints } from "@common/utils/breakpoints";
import { isAnnotationBreakpoint } from "@common/utils/breakpoint-scope";
import {
  incBreakpointsVersionAction,
  incEditorVersionAction,
  resetBackgroundCompileAction,
  startBackgroundCompileAction,
  setCursorPositionAction,
  setIdeStatusMessageAction
} from "@common/state/actions";
import type { CopperBlock } from "@common/zxnext/copper/copperBlocks";
import { DocumentApi } from "@renderer/abstractions/DocumentApi";
import {
  useDocumentHubService,
  useDocumentHubServiceVersion
} from "@renderer/appIde/services/DocumentServiceProvider";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { getIsWindows } from "@renderer/os-utils";
import { MI_ZXNEXT } from "@common/machines/constants";
import {
  copperIndexesForSourceLine,
  copperSourceFileIndex,
  isCopperSourceLine
} from "@renderer/features/copper/copperSourceBreakpoints";
import { getMonospaceFontFamily } from "@common/settings/monospace-fonts";
import { useEmuApi } from "@renderer/core/EmuApi";
import { createEmuApi } from "@common/messaging/EmuApi";
import { createMainApi } from "@common/messaging/MainApi";
import { useMainApi } from "@renderer/core/MainApi";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  SETTING_EDITOR_AUTOCOMPLETE,
  SETTING_EDITOR_DETECT_INDENTATION,
  SETTING_EDITOR_FONT_SIZE,
  SETTING_EDITOR_FONT_FAMILY,
  SETTING_EDITOR_SELECTION_HIGHLIGHT,
  SETTING_EDITOR_INSERT_SPACES,
  SETTING_EDITOR_RENDER_WHITESPACE,
  SETTING_EDITOR_TABSIZE,
  SETTING_EDITOR_OCCURRENCES_HIGHLIGHT,
  SETTING_EDITOR_QUICK_SUGGESTION_DELAY,
  SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE,
  SETTING_EMU_JUST_MY_CODE
} from "@common/settings/setting-const";
import { Store } from "@common/state/redux-light";
import { AppState } from "@common/state/AppState";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import { hasSourceLevelDebug, isDebuggableCompilerOutput } from "@renderer/appIde/utils/compiler-utils";
import { listItemsAtPc, locateSource, type SourceLocation } from "@renderer/appIde/utils/source-location";
import { reanchorColumn, runToCursorAddress, sourceFileIndex, statementMarkers } from "./statementBreakpoints";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@controls/ContextMenu";
import { useBreakpointDialog } from "@renderer/appIde/dialogs/useBreakpointDialog";
import {
  breakpointFilterLines,
  breakpointGlyphOf,
  isConditionalBreakpoint,
  isInactiveBreakpoint
} from "@renderer/appIde/utils/breakpoint-filter-text";
import {
  marginMenuItems,
  asOneShot,
  oneShotToggle,
  runMarginAction,
  type MarginTarget
} from "./marginBreakpointMenu";
import { stepIntoTargets } from "@renderer/appIde/debugger/source/step-targets";
import { buildSourceCallStack } from "@renderer/appIde/debugger/source/call-stack-model";
import type { SourceActivationInfo, SourceStopInfo } from "@abstractions/SourceDebugInfo";
import { statementAtColumn } from "@common/utils/breakpoints";
import { setCommentBreakpointsEnabled } from "@renderer/appIde/utils/annotation-state";
import { commentKindOf } from "@common/utils/source-annotations";
import { languageIntelSingleton } from "@renderer/appIde/services/LanguageIntelService";
import { basicIntelSingleton } from "@renderer/appIde/services/BasicIntelService";
import { notifySemanticTokensChanged, type RenameEdit } from "@renderer/appIde/services/z80-providers";
import { defineLanguageThemes, initializeMonaco, isMonacoInitialized } from "./monacoBootstrap";
import {
  setMonacoExternalEditHandler,
  setMonacoNavigationHandler,
  setMonacoProjectFilesHandler,
  setMonacoProviderStore
} from "./monacoGlobals";
import { applyExternalRenameEdits } from "./monacoExternalEdits";
import { applyMonacoUserOptions } from "./monacoEditorOptions";
import { registerMonacoDebugShortcuts } from "./monacoDebugShortcuts";
import { publishEditorCursorPosition } from "./monacoCursorPosition";
import { getNormalizedLineNumberSelection } from "./monacoLineNumberSelection";
import { pasteTextIntoEditor } from "./monacoClipboard";
import { BackgroundCompileScheduler } from "./monacoBackgroundCompile";

export { initializeMonaco } from "./monacoBootstrap";

let MAX_BP_UNDO_STACK = 64;

// --- We use these shortcuts in this file for Monaco types
type Decoration = monacoEditor.editor.IModelDeltaDecoration;
type EditorDecorationsCollection = monacoEditor.editor.IEditorDecorationsCollection;
type MarkdownString = monacoEditor.IMarkdownString;

// --- Monaco's MouseTargetType enum is visible in types, but not exported by
// --- the renderer bundle entry at runtime.
const MONACO_GUTTER_GLYPH_MARGIN = 2;
const MONACO_GUTTER_LINE_NUMBERS = 3;
const MONACO_CONTENT_TEXT = 6;

// --- This type represents the API that we can access from outside
export type EditorApi = DocumentApi & {
  setPosition(lineNo: number, column: number): void;
};

// --- Key to re-bind
const keysToRebind = [
  { key: monacoEditor.KeyCode.F1, shortCut: "F1" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F1, shortCut: "Shift+F1" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F1, shortCut: "Ctrl+F1" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F1, shortCut: "Alt+F1" },
  { key: monacoEditor.KeyCode.F2, shortCut: "F2" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F2, shortCut: "Shift+F2" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F2, shortCut: "Ctrl+F2" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F2, shortCut: "Alt+F2" },
  { key: monacoEditor.KeyCode.F3, shortCut: "F3" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F3, shortCut: "Shift+F3" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F3, shortCut: "Ctrl+F3" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F3, shortCut: "Alt+F3" },
  { key: monacoEditor.KeyCode.F4, shortCut: "F4" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F4, shortCut: "Shift+F4" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F4, shortCut: "Ctrl+F4" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F4, shortCut: "Alt+F4" },
  { key: monacoEditor.KeyCode.F5, shortCut: "F5" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F5, shortCut: "Shift+F5" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F5, shortCut: "Ctrl+F5" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F5, shortCut: "Alt+F5" },
  { key: monacoEditor.KeyCode.F6, shortCut: "F6" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F6, shortCut: "Shift+F6" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F6, shortCut: "Ctrl+F6" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F6, shortCut: "Alt+F6" },
  { key: monacoEditor.KeyCode.F7, shortCut: "F7" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F7, shortCut: "Shift+F7" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F7, shortCut: "Ctrl+F7" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F7, shortCut: "Alt+F7" },
  { key: monacoEditor.KeyCode.F8, shortCut: "F8" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F8, shortCut: "Shift+F8" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F8, shortCut: "Ctrl+F8" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F8, shortCut: "Alt+F8" },
  { key: monacoEditor.KeyCode.F9, shortCut: "F9" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F9, shortCut: "Shift+F9" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F9, shortCut: "Ctrl+F9" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F9, shortCut: "Alt+F9" },
  { key: monacoEditor.KeyCode.F10, shortCut: "F10" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F10, shortCut: "Shift+F10" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F10, shortCut: "Ctrl+F10" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F10, shortCut: "Alt+F10" },
  { key: monacoEditor.KeyCode.F11, shortCut: "F11" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F11, shortCut: "Shift+F11" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F11, shortCut: "Ctrl+F11" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F11, shortCut: "Alt+F11" },
  { key: monacoEditor.KeyCode.F12, shortCut: "F12" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F12, shortCut: "Shift+F12" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F12, shortCut: "Ctrl+F12" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F12, shortCut: "Alt+F12" }
];

// --- Monaco editor component properties
type EditorProps = {
  document: ProjectDocumentState;
  value: string;
  apiLoaded?: (api: EditorApi) => void;
  languageOverride?: string;
};

// --- This component wraps the Monaco editor
export const MonacoEditor = ({ document, value, apiLoaded, languageOverride }: EditorProps) => {
  // --- Monaco editor instance and related state variables
  const editor = useRef<monacoEditor.editor.IStandaloneCodeEditor>(null);
  // --- Bumped on every mount, so effects that need the editor itself re-run once it exists
  const [editorReady, setEditorReady] = useState(0);
  const mounted = useRef(false);

  // --- Keep track of the editors undo stack
  const undoStack = useRef<Map<string, BreakpointInfo[][]>>(new Map());
  const redoStack = useRef<Map<string, BreakpointInfo[][]>>(new Map());

  // --- Recognize app theme changes and update Monaco editor theme accordingly
  const { theme } = useTheme();
  const selectedAccent = useSelector((s) => s.accent);
  const accentId: AccentId = isAccentId(selectedAccent) ? selectedAccent : DEFAULT_ACCENT;
  const monacoRef = useRef<typeof monacoEditor>();
  const mainApi = useMainApi();
  const [monacoTheme, setMonacoTheme] = useState("");

  // --- Respond to editor font size change requests
  const editorFontSize = useGlobalSetting(SETTING_EDITOR_FONT_SIZE);

  // --- Respond to editor font family change requests. The setting stores a platform-independent
  // --- id; resolving it here keeps a value written on another platform from breaking the editor.
  const editorFontId = useGlobalSetting(SETTING_EDITOR_FONT_FAMILY);
  const isWindowsPlatform = useSelector((s) => s.isWindows ?? false);
  const editorFontFamily = getMonospaceFontFamily(editorFontId, isWindowsPlatform);

  // --- We use these services to respond to various IDE events
  const { store, messenger } = useRendererContext();
  const { projectService, ideCommandsService } = useAppServices();
  const emuApi = useEmuApi();

  // --- Recognize if something changed in the current document hub
  const documentHubService = useDocumentHubService();
  const hubVersion = useDocumentHubServiceVersion();

  // --- Use these state variables to manage breakpoints and their changes
  const breakpointsVersion = useSelector((s) => s.emulatorState.breakpointsVersion);
  const sourceFrame = useSelector((s) => s.ideView?.sourceFrame ?? 0);
  const breakpoints = useRef<BreakpointInfo[]>([]);
  const compilation = useSelector((s) => s.compilation);
  const execState = useSelector((s) => s.emulatorState?.machineState);
  // --- The history cursor (`.plans/LITE_STEP_BACK_PLAN.md` D2, D7): the execution marker follows it
  const historyPosition = useSelector((s) => s.emulatorState?.historyPosition);
  const isProjectDebugging = useSelector((s) => s.emulatorState?.isProjectDebugging ?? false);

  // --- Store Monaco editor decorations to display breakpoint information
  const bpDecorations = useRef<EditorDecorationsCollection>(null);
  const hoverDecorations = useRef<EditorDecorationsCollection>(null);
  const execPointDecoration = useRef<EditorDecorationsCollection>(null);
  // --- Step Into Target's context-menu items (plan §10.2.4), one per routine the stopped statement calls
  const stepTargetActions = useRef<monacoEditor.IDisposable[]>([]);
  const errorWarningDecorations = useRef<EditorDecorationsCollection>(null);
  const refreshEditorBreakpoints = useRef<() => Promise<void>>(async () => undefined);

  // --- Background compiles: debounced after edits, one at a time, none lost (see the helper)
  const compileScheduler = useRef<BackgroundCompileScheduler>(null);

  // --- Line-number clicks select the right text, but Monaco leaves the active
  // --- cursor on the next line. Keep the clicked line until mouse-up, then
  // --- normalize only simple single-line gutter selections.
  const lineNumberSelectionClick = useRef<number | null>(null);

  // --- The breakpoint margin's right-click menu (conditional breakpoints plan §4.4.2)
  const [marginMenuState, marginMenuApi] = useContextMenuState();
  const [marginTarget, setMarginTarget] = useState<MarginTarget>();
  const openBreakpointDialog = useBreakpointDialog();

  // --- The name of the resource this editor displays
  const resourceName = document.node?.projectPath;

  // --- The language to use with Monaco editor for syntax highlighting
  const [languageInfo, setLanguageInfo] = useState(
    customLanguagesRegistry.find((l) => l.id === document.language)
  );

  // --- Use these states to update editor options
  const enableAutoComplete = useGlobalSetting(SETTING_EDITOR_AUTOCOMPLETE);
  const insertSpaces = useGlobalSetting(SETTING_EDITOR_INSERT_SPACES);
  const renderWhitespaces = useGlobalSetting(SETTING_EDITOR_RENDER_WHITESPACE);
  const tabSize = useGlobalSetting(SETTING_EDITOR_TABSIZE);
  const detectIndentation = useGlobalSetting(SETTING_EDITOR_DETECT_INDENTATION);
  const enableSelectionHighlight = useGlobalSetting(SETTING_EDITOR_SELECTION_HIGHLIGHT);
  const enableOccurrencesHighlight = useGlobalSetting(SETTING_EDITOR_OCCURRENCES_HIGHLIGHT);
  const quickSuggestionDelay = useGlobalSetting(SETTING_EDITOR_QUICK_SUGGESTION_DELAY);
  const allowBackgroundCompile = useGlobalSetting(SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE);

  // --- Background compilation
  const backgroundResult = useSelector((s) => s.compilation.backgroundResult);
  const backgroundInProgress = useSelector((s) => s.compilation.backgroundInProgress ?? false);

  // --- The scheduler reads these when a request fires, so it always sees the current values
  const compileContext = useRef({ store, mainApi, allowBackgroundCompile, documentId: document.id, documentLanguage: document.language });
  compileContext.current = { store, mainApi, allowBackgroundCompile, documentId: document.id, documentLanguage: document.language };
  if (!compileScheduler.current) {
    compileScheduler.current = new BackgroundCompileScheduler({
      isRunning: () => compileContext.current.store.getState().compilation?.backgroundInProgress ?? false,
      start: () => {
        const { store, mainApi, allowBackgroundCompile, documentId, documentLanguage } = compileContext.current;
        return startBackgroundCompile(store, mainApi, allowBackgroundCompile, { id: documentId, language: documentLanguage });
      }
    });
  }
  useEffect(() => () => compileScheduler.current?.dispose(), []);

  // --- A compile finished, with any result: run the one requested while it ran
  useEffect(() => {
    if (!backgroundInProgress) compileScheduler.current?.compileFinished();
  }, [backgroundInProgress]);

  // --- Language intelligence data (updated after each background compile)
  const languageIntel = useSelector((s) => s.compilation.languageIntel);

  // --- Keep the singleton intel service in sync with the latest compiled data
  useEffect(() => {
    if (languageIntel) {
      languageIntelSingleton.update(languageIntel);
      // Tell Monaco to re-request semantic tokens immediately
      notifySemanticTokensChanged();
    }
  }, [languageIntel]);

  // --- Klive BASIC intel: every snapshot, with the build root's preferred (plan §4.3)
  const basicIntel = useSelector((s) => s.compilation.basicIntel);
  const projectFolder = useSelector((s) => s.project?.folderPath);
  const buildRootFile = useSelector((s) => s.project?.buildRoots?.[0]);
  useEffect(() => {
    basicIntelSingleton.update(basicIntel, projectFolder && buildRootFile ? `${projectFolder}/${buildRootFile}` : undefined);
  }, [basicIntel, projectFolder, buildRootFile]);

  // --- The project's files, for `#include "..."` completion in `.zxbas` files
  useEffect(() => {
    return setMonacoProjectFilesHandler(() => {
      const files: string[] = [];
      projectService.getProjectTree()?.rootNode.forEachDescendant((n) => {
        if (!n.data.isFolder && n.data.fullPath) files.push(n.data.fullPath);
      });
      return files;
    });
  }, [projectService]);

  // --- Wire the module-level cross-file navigation callback to this component's
  // --- ideCommandsService so that registerEditorOpener can open files in Klive.
  useEffect(() => {
    return setMonacoNavigationHandler((filePath: string, line: number, column?: number) => {
      // --- `nav` takes its column one higher than Monaco's and subtracts one before calling
      // --- `setPosition` (the output-pane links rely on that), so a Monaco column goes in as +1.
      const columnArg = column === undefined ? "" : ` ${column + 1}`;
      ideCommandsService.executeCommand(`nav "${filePath}" ${line}${columnArg} -r definition`);
    });
  }, [ideCommandsService]);

  // --- Wire the module-level store reference so that providers can read current state.
  useEffect(() => {
    return setMonacoProviderStore(store);
  }, [store]);

  // --- Wire the module-level cross-file rename callback so that the rename
  // --- provider can apply edits to files other than the currently open one.
  useEffect(() => {
    return setMonacoExternalEditHandler((edits: RenameEdit[]) => {
      void applyExternalRenameEdits(mainApi, projectService, edits);
    });
  }, [mainApi, projectService]);

  // --- Update editor file language changes
  useEffect(() => {
    setLanguageInfo(customLanguagesRegistry.find((l) => l.id === document.language));
  }, [document.language]);

  // --- Update user-controlled Monaco options when settings change.
  useEffect(() => {
    applyMonacoUserOptions(editor.current, {
      enableAutoComplete,
      insertSpaces,
      renderWhitespaces,
      tabSize,
      detectIndentation,
      enableSelectionHighlight,
      enableOccurrencesHighlight,
      quickSuggestionDelay
    });
  }, [
    enableAutoComplete,
    insertSpaces,
    renderWhitespaces,
    tabSize,
    detectIndentation,
    enableSelectionHighlight,
    enableOccurrencesHighlight,
    quickSuggestionDelay
  ]);

  /*
   * Respond to theme *and accent* changes.
   *
   * The syntax palette follows the accent (§8.1), so a theme's contents change while its name stays
   * the same. Re-defining is therefore not enough on its own: React would not re-apply an unchanged
   * `theme` prop, so `setTheme` is called explicitly after the definitions are refreshed.
   */
  const themeNameFor = (tone: string) => {
    const languageInfo = customLanguagesRegistry.find((l) => l.id === document.language);
    return languageInfo ? `${languageInfo.id}-${tone}` : tone === "light" ? "vs" : "vs-dark";
  };

  useEffect(() => {
    const monaco = monacoRef.current;
    const themeName = themeNameFor(theme.tone);
    if (monaco) {
      defineLanguageThemes(monaco, theme.tone as "light" | "dark", accentId);
      monaco.editor.setTheme(themeName);
    }
    setMonacoTheme(themeName);
  }, [theme, accentId, document.language]);

  // --- Respond to readonly and locked document changes
  useEffect(() => {
    if (editor.current) {
      editor.current.updateOptions({
        readOnly: document.isReadOnly || (document.isLocked && isProjectDebugging)
      });
    }
  }, [document.isReadOnly, document.isLocked, isProjectDebugging]);

  // --- Keep the refresh callback current without making the trigger effect
  // --- depend on the large local breakpoint helper identities.
  refreshEditorBreakpoints.current = async () => {
    if (editor.current) {
      const bps = await refreshBreakpoints();
      await refreshCurrentBreakpoint(bps);
    }
  };

  // --- Code coverage's strip (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D12): its own collection
  useCoverageDecorations(editor, editorReady, document.id, COVERAGE_CLASSES);

  // --- Refresh breakpoints when they may change
  useEffect(() => {
    void refreshEditorBreakpoints.current();
  }, [breakpointsVersion, compilation, execState, hubVersion, sourceFrame, historyPosition]);

  useEffect(() => {
    // Clear previous decorations and model markers
    errorWarningDecorations.current?.clear();
    const currentModel = editor.current?.getModel();
    if (currentModel) {
      monacoEditor.editor.setModelMarkers(currentModel, "klive-z80", []);
    }

    // Don't proceed if no editor or no background result or if background compilation is disabled
    if (!editor.current || !backgroundResult || !allowBackgroundCompile) {
      return;
    }

    // Don't proceed if successful compilation or no errors
    if (
      backgroundResult.success ||
      !backgroundResult.errors ||
      backgroundResult.errors.length === 0
    ) {
      return;
    }

    // Get the current file path
    const currentFile = document.node?.projectPath;
    if (!currentFile) return;

    // Filter errors for the current file
    const fileErrors = backgroundResult.errors.filter((err) => err.filename.endsWith(currentFile));

    // Also collect invocation-site references embedded in messages of errors whose primary
    // filename is a different file (e.g. the macro body). The macro invocation prefix
    // written by buildMacroInvocationPrefix contains `at <file>:<line>:<col>` entries.
    type InvocationRef = { line: number; col: number; message: string; isWarning: boolean };
    const invocationRefs: InvocationRef[] = [];
    const atRef = /\bat\s+(\S+?):(\d+):(\d+)/g;
    backgroundResult.errors.forEach((err) => {
      if (err.filename.endsWith(currentFile)) return; // already handled by fileErrors
      atRef.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = atRef.exec(err.message)) !== null) {
        if (m[1].endsWith(currentFile)) {
          invocationRefs.push({
            line: parseInt(m[2], 10),
            col: parseInt(m[3], 10) + 1, // startColumn is 0-based; Monaco is 1-based
            message: err.message,
            isWarning: !!err.isWarning
          });
        }
      }
    });

    if (fileErrors.length === 0 && invocationRefs.length === 0) return;

    const model = editor.current.getModel();
    if (!model) return;

    const markers: monacoEditor.editor.IMarkerData[] = [];
    const afterDecorations: Decoration[] = [];

    // Helper that computes start/end column for a marker on a given line
    const getLineCols = (lineNo: number): { startCol: number; endCol: number } => {
      let startCol = 1;
      if (lineNo <= model.getLineCount()) {
        const lineContent = model.getLineContent(lineNo);
        const match = lineContent.match(/\S/);
        startCol = match ? (match.index ?? 0) + 1 : 1;
      }
      let endCol = startCol + 1;
      if (lineNo <= model.getLineCount()) {
        endCol = model.getLineLength(lineNo) + 1;
      }
      if (endCol <= startCol) endCol = startCol + 1;
      return { startCol, endCol };
    };

    // --- A compiler whose language says its columns are exact marks just the offending text
    const exactColumns = !!customLanguagesRegistry.find((l) => l.id === document.language)
      ?.exactErrorColumns;
    const getErrorCols = (err: (typeof fileErrors)[number]): { startCol: number; endCol: number } => {
      const hasRange =
        exactColumns &&
        typeof err.startColumn === "number" &&
        typeof err.endColumn === "number" &&
        err.endColumn > err.startColumn;
      // --- 0-based in the error, 1-based in Monaco
      return hasRange
        ? { startCol: err.startColumn + 1, endCol: err.endColumn + 1 }
        : getLineCols(err.line || 1);
    };

    // --- Monaco renders a long text run as several spans, each with the decoration's class, and the
    // --- stylesheet joins adjacent same-class spans into one pill. So a line gets one badge per
    // --- severity, its messages joined, or two messages would fuse into one pill with no separator.
    const badges = new Map<string, { lineNo: number; messages: string[]; isWarning: boolean }>();
    const addBadge = (lineNo: number, message: string, isWarning: boolean | undefined) => {
      const key = `${lineNo}:${!!isWarning}`;
      const badge = badges.get(key) ?? { lineNo, messages: [], isWarning: !!isWarning };
      if (!badge.messages.includes(message)) badge.messages.push(message);
      badges.set(key, badge);
    };

    fileErrors.forEach((err) => {
      const lineNo = err.line || 1;
      const isWarning = err.isWarning;
      const { startCol, endCol } = getErrorCols(err);

      // Standard Monaco marker: squiggles + scrollbar overview ruler + minimap + hover tooltip
      markers.push({
        severity: isWarning
          ? monacoEditor.MarkerSeverity.Warning
          : monacoEditor.MarkerSeverity.Error,
        message: err.message || "Issue detected",
        startLineNumber: lineNo,
        startColumn: startCol,
        endLineNumber: lineNo,
        endColumn: endCol
      });

      addBadge(lineNo, err.message || "Issue detected", isWarning);
    });

    // Add markers for invocation sites found in macro error message prefixes
    invocationRefs.forEach(({ line: lineNo, col: startColHint, message, isWarning }) => {
      const { startCol, endCol } = getLineCols(lineNo);
      // Use the startCol from the message if it's more precise than the line's first non-ws
      const col = Math.max(startColHint, startCol);
      markers.push({
        severity: isWarning
          ? monacoEditor.MarkerSeverity.Warning
          : monacoEditor.MarkerSeverity.Error,
        message,
        startLineNumber: lineNo,
        startColumn: col,
        endLineNumber: lineNo,
        endColumn: endCol
      });
      addBadge(lineNo, message, isWarning);
    });

    // Custom inline pill/badge displayed after the line content: one per line and severity
    badges.forEach(({ lineNo, messages, isWarning }) => {
      const { startCol, endCol } = getLineCols(lineNo);
      afterDecorations.push({
        range: new monacoEditor.Range(lineNo, startCol, lineNo, endCol),
        options: {
          after: {
            content: messages.join("  \u2022  "),
            inlineClassName: isWarning ? styles.warningIcon : styles.errorIcon
          },
          isWholeLine: false
        }
      });
    });

    monacoEditor.editor.setModelMarkers(model, "klive-z80", markers);
    if (afterDecorations.length > 0) {
      errorWarningDecorations.current = editor.current.createDecorationsCollection(afterDecorations);
    }
  }, [backgroundResult, document.node?.projectPath, document.language, allowBackgroundCompile]);

  useEffect(() => {
    if (store && mainApi) void compileScheduler.current?.requestNow();
  }, [store, mainApi, allowBackgroundCompile]);

  // --- Initializes the editor when mounted
  const onMount = (ed: monacoEditor.editor.IStandaloneCodeEditor, monaco: typeof monacoEditor): void => {
    /*
     * Held so the theme effect can re-define the language themes when the accent changes.
     *
     * The themes must also be defined *here*, not only in that effect: the effect runs on mount
     * while this callback has not fired yet, so `monacoRef` is still empty and the first pass
     * defines nothing. Without this the editor would open on Monaco's bare `vs-dark` and only pick
     * up the Klive palette on a later theme or accent change.
     */
    monacoRef.current = monaco;
    defineLanguageThemes(monaco, theme.tone as "light" | "dark", accentId);
    monaco.editor.setTheme(themeNameFor(theme.tone));
    // --- Restore the view state to display the editor is it has been left
    mounted.current = false;
    editor.current = ed;
    setEditorReady((v) => v + 1);

    // --- We need to add these commands to the editor to be able to use the shortcuts.
    // --- Otherwise, the v0.46.0 Monaco editor will not work properly with Electron v0.35.1.
    ed.addCommand(monacoEditor.KeyMod.CtrlCmd | monacoEditor.KeyCode.KeyY, () =>
      ed.trigger("keyboard", "redo", null)
    );

    // --- Clipboard handling for the entire Monaco editor (both the code area and
    // --- widget inputs like Find/Replace and Rename).
    // --- In Electron, native Cmd+C/V/X/A don't work. Monaco's addCommand always
    // --- targets the editor model regardless of which element has focus, so we use
    // --- a capture-phase DOM listener on the editor container instead.
    const editorDom = ed.getContainerDomNode();
    const clipboardHandler = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "v" && key !== "x" && key !== "a") return;

      const activeEl = window.document.activeElement;
      const isWidgetInput = activeEl?.tagName === "INPUT" || 
        (activeEl?.tagName === "TEXTAREA" && !activeEl.classList.contains("inputarea"));

      if (isWidgetInput) {
        // --- The focused element is a widget input (Find/Replace, Rename, etc.)
        const input = activeEl as HTMLInputElement;
        e.preventDefault();
        e.stopImmediatePropagation();

        if (key === "c") {
          const text = input.value.slice(
            input.selectionStart ?? 0,
            input.selectionEnd ?? input.value.length
          );
          if (text) await navigator.clipboard.writeText(text);
        } else if (key === "v") {
          const clipText = await navigator.clipboard.readText();
          const start = input.selectionStart ?? 0;
          const end = input.selectionEnd ?? 0;
          input.focus();
          input.setSelectionRange(start, end);
          window.document.execCommand("insertText", false, clipText);
        } else if (key === "x") {
          const text = input.value.slice(
            input.selectionStart ?? 0,
            input.selectionEnd ?? input.value.length
          );
          if (text) await navigator.clipboard.writeText(text);
          window.document.execCommand("delete");
        } else if (key === "a") {
          input.select();
        }
      } else {
        // --- The code editor text area has focus
        e.preventDefault();
        e.stopImmediatePropagation();

        if (key === "c") {
          const selection = ed.getSelection();
          const text = ed.getModel()?.getValueInRange(selection);
          if (text) navigator.clipboard.writeText(text);
        } else if (key === "v") {
          pasteTextIntoEditor(ed, await navigator.clipboard.readText());
        } else if (key === "x") {
          const selection = ed.getSelection();
          const text = ed.getModel()?.getValueInRange(selection);
          if (text) {
            navigator.clipboard.writeText(text);
            ed.executeEdits("clipboard", [{
              range: selection,
              text: "",
              forceMoveMarkers: true
            }]);
          }
        } else if (key === "a") {
          const model = ed.getModel();
          if (model) {
            ed.setSelection(model.getFullModelRange());
          }
        }
      }
    };
    editorDom.addEventListener("keydown", clipboardHandler, true);

    const saveViewState = () => {
      if (mounted.current) {
        const viewState = ed.saveViewState();
        documentHubService.setDocumentViewState(document.id, viewState);
      }
    };

    // --- Mount events to save the view state
    const disposables: monacoEditor.IDisposable[] = [];
    // --- Source-level debugging actions (plan §10.3, §10.5): the statement under the cursor
    if (languageInfo?.supportsBreakpoints) {
      disposables.push(
        ed.addAction({
          id: "klive.toggleStatementBreakpoint",
          label: "Toggle Breakpoint at Statement",
          contextMenuGroupId: "klive-debug",
          contextMenuOrder: 1,
          run: (target) => {
            const position = target.getPosition();
            if (position) void toggleStatementBreakpoint(position.lineNumber, position.column - 1);
          }
        }),
        ed.addAction({
          id: "klive.stopHereOnce",
          label: "Stop Here Once",
          contextMenuGroupId: "klive-debug",
          contextMenuOrder: 1.5,
          run: (target) => {
            const position = target.getPosition();
            if (position) void stopHereOnce(position.lineNumber, position.column - 1);
          }
        }),
        ed.addAction({
          id: "klive.runToCursor",
          label: "Run to Cursor",
          contextMenuGroupId: "klive-debug",
          contextMenuOrder: 2,
          run: (target) => {
            const position = target.getPosition();
            if (!position) return;
            const address = runToCursorAddress(
              store.getState().compilation?.result,
              getResourceName(),
              getIsWindows(),
              position.lineNumber,
              position.column - 1
            );
            if (address === undefined) return;
            void ideCommandsService.executeCommand(`run-to $${address.toString(16).padStart(4, "0")}`);
          }
        })
      );
    }
    disposables.push(
      ed.onMouseDown(handleEditorMouseDown),
      ed.onContextMenu(handleEditorContextMenu),
      ed.onMouseUp(handleEditorMouseUp),
      ed.onMouseLeave(handleEditorMouseLeave),
      ed.onMouseMove(handleEditorMouseMove),
      ed.onDidChangeCursorPosition(saveViewState),
      ed.onDidChangeCursorSelection(saveViewState),
      ed.onDidScrollChange(saveViewState),
      ed.onDidBlurEditorWidget(saveViewState),
      ed.onDidChangeCursorPosition((e) => {
        documentHubService.saveActiveDocumentPosition(e.position.lineNumber, e.position.column);
        store.dispatch(incEditorVersionAction());
        store.dispatch(setCursorPositionAction(e.position.lineNumber, e.position.column));
      })
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

      // --- Reload content from external file change
      reloadContent: (contents: string | Uint8Array) => {
        if (typeof contents === "string") {
          const model = editor.current.getModel();
          if (model) {
            // Save current cursor position
            const position = editor.current.getPosition();
            const selection = editor.current.getSelection();

            // Update content
            model.setValue(contents);

            // Restore cursor position if possible
            if (position) {
              editor.current.setPosition(position);
              if (selection) {
                editor.current.setSelection(selection);
              }
            }

            // Update document state
            document.contents = contents;
            document.savedVersionCount = document.editVersionCount;
            store.dispatch(incEditorVersionAction());
          }
        }
      },

      // --- Where the cursor is, for the navigation history. A disposed editor has no model and
      // --- answers null, and the text adapter then falls back to `document.editPosition`.
      getNavigationLocator: () => {
        const position = ed.getModel() ? ed.getPosition() : null;
        return position
          ? { kind: "text", line: position.lineNumber, column: position.column }
          : undefined;
      },

      // --- Editor API specific
      setPosition: (lineNumber: number, column: number) => {
        ed.revealLineInCenter(lineNumber);
        ed.setPosition({ lineNumber, column });
        ed.focus();
        store.dispatch(incEditorVersionAction());
      }
    };

    // --- Pass back the API so that the document hub service can use it
    apiLoaded?.(editorApi);

    const viewState = documentHubService.getDocumentViewState(document.id);
    if (viewState) {
      ed.restoreViewState(viewState);
    }

    // --- Report where the cursor now is. Restoring the position rarely fires a cursor-change event
    // --- (the cursor is often already there), so without this the status bar kept the line and
    // --- column of the previously shown document.
    publishEditorCursorPosition(ed, (action) => store.dispatch(action));

    // --- Set the editor's user-controlled options
    applyMonacoUserOptions(ed, {
      enableAutoComplete,
      insertSpaces,
      renderWhitespaces,
      tabSize,
      detectIndentation,
      enableSelectionHighlight,
      enableOccurrencesHighlight,
      quickSuggestionDelay
    });

    void registerMonacoDebugShortcuts(ed, mainApi, emuApi, store, keysToRebind);

    // --- Focus the editor
    ed.focus();

    // --- Dispose event handlers when the editor is about to dispose
    editor.current.onDidDispose(() => {
      disposables.forEach((d) => d.dispose());
      editorDom.removeEventListener("keydown", clipboardHandler, true);
    });

    mounted.current = true;

    // --- Nudge Monaco to re-apply semantic tokens immediately (avoids the
    // --- colour-shift delay that's visible after switching back to this tab)
    setTimeout(() => notifySemanticTokensChanged(), 0);

    // --- Start background compilation
    void compileScheduler.current?.requestNow();

    // --- Show breakpoints and other decorations when initially displaying the editor
    (async () => {
      const bps = await refreshBreakpoints();
      await refreshCurrentBreakpoint(bps);
    })();
  };

  // --- Handle document changes
  const onValueChanged = async (_: string, e: monacoEditor.editor.IModelContentChangedEvent) => {
    // --- Now, make this document permanent
    projectService.setPermanent(document.id);

    // --- Handle breakpoint redos and undos
    const resourceKey = `${editor.current.getId()}-${resourceName}`;
    if (e.isUndoing) {
      // --- Undo the breakpoints
      const currentSet = undoStack.current.get(resourceKey);
      if (currentSet && currentSet.length > 0) {
        // --- We have a set of breakpoints to restore, get it from the stack
        const lastSet = currentSet.pop();

        // --- Restore the previous breakpoints. Scoped to `project`: these snapshots are of the
        // --- project's own breakpoints, so an editor undo must not reach breakpoints owned by a
        // --- `.nex` sidecar or by a live debug session. (The snapshot is still whole-set within
        // --- that scope, i.e. it also restores other files' source breakpoints — narrowing it to
        // --- one resource is a separate change.)
        await createEmuApi(messenger).resetBreakpointsTo(lastSet, { kind: "project" });

        // --- Update the redo stack
        let currentRedo = redoStack.current.get(resourceKey);
        if (!currentRedo) {
          currentRedo = [];
          redoStack.current.set(resourceKey, currentRedo);
        }
        currentRedo.push(lastSet);

        // --- Keep the redo length limit
        if (currentRedo.length > MAX_BP_UNDO_STACK) {
          currentRedo.shift();
        }
      }
    } else if (e.isRedoing) {
      // --- Redo the breakpoints
      const currentSet = redoStack.current.get(resourceKey);
      if (currentSet && currentSet.length > 0) {
        // --- We have a set of breakpoints to restore, get it from the stack
        const lastSet = currentSet.pop();

        // --- Restore the previous breakpoints. Scoped to `project`: these snapshots are of the
        // --- project's own breakpoints, so an editor undo must not reach breakpoints owned by a
        // --- `.nex` sidecar or by a live debug session. (The snapshot is still whole-set within
        // --- that scope, i.e. it also restores other files' source breakpoints — narrowing it to
        // --- one resource is a separate change.)
        await createEmuApi(messenger).resetBreakpointsTo(lastSet, { kind: "project" });

        // --- Update the undo stack
        let currentUndo = undoStack.current.get(resourceKey);
        if (!currentUndo) {
          currentUndo = [];
          undoStack.current.set(resourceKey, currentUndo);
        }
        currentUndo.push(lastSet);

        // --- Keep the redo length limit
        if (currentUndo.length > MAX_BP_UNDO_STACK) {
          currentUndo.shift();
        }
      }
    } else {
      // --- We are executing a normal (not redo or undo) operation
      // --- Get the current set of breakpoints
      const breakpoints = await getBreakpoints(messenger);

      // --- Get the undo stack of this document
      let currentSet = undoStack.current.get(resourceKey);
      if (!currentSet) {
        currentSet = [];
        undoStack.current.set(resourceKey, currentSet);
      }

      // --- Push the current breakpoints to the undo stack
      currentSet.push(breakpoints);

      // --- Keep the undo length limit
      if (currentSet.length > MAX_BP_UNDO_STACK) {
        currentSet.shift();
      }

      // --- Does the editor support breakpoints?
      if (languageInfo?.supportsBreakpoints) {
        // --- Keep track of breakpoint changes
        if (e.changes.length > 0) {
          // --- Special case: after changing to readonly, the editor signals
          // --- that the entire text has been changed.
          const currentText = editor.current.getModel().getValue();
          if (currentText !== e.changes?.[0].text) {
            // --- A real change has happened
            // --- Get the text that has been deleted
            const change = e.changes[0];
            const deletedText = editor.current.getModel().getValueInRange(change.range);
            const deletedLines = (deletedText.match(new RegExp(e.eol, "g")) || []).length;

            // --- Have we deleted one or more EOLs?
            if (deletedLines > 0) {
              const lowerBound =
                change.range.startLineNumber + (change.range.startColumn === 1 ? 0 : 1);
              const upperBound = change.range.endLineNumber;

              // --- Yes, scroll up breakpoints
              await createEmuApi(messenger).scrollBreakpoints(
                {
                  resource: resourceName,
                  line: lowerBound
                },
                -deletedLines,
                lowerBound,
                upperBound
              );
            }

            // --- Have we inserted one or more EOLs?
            const insertedLines = (change.text.match(new RegExp(e.eol, "g")) || []).length;
            if (insertedLines > 0) {
              // --- Yes, scroll down breakpoints.
              const lineText = editor.current
                .getModel()
                .getLineContent(change.range.startLineNumber);
              const shouldShiftDown = lineText?.trim().length === 0;
              await createEmuApi(messenger).scrollBreakpoints(
                {
                  resource: resourceName,
                  line: change.range.startLineNumber + (shouldShiftDown ? 0 : 1)
                },
                insertedLines
              );
            }

            // --- An edit inside one line re-anchors that line's statement breakpoints (§10.3)
            if (deletedLines === 0 && insertedLines === 0 && change.range.startLineNumber === change.range.endLineNumber) {
              const line = change.range.startLineNumber;
              const onLine = breakpoints.filter((bp) => bp.resource === resourceName && bp.line === line && bp.column !== undefined);
              if (onLine.length) {
                const newText = editor.current.getModel().getLineContent(line);
                const emu = createEmuApi(messenger);
                for (const bp of onLine) {
                  const column = reanchorColumn(
                    bp.column,
                    { startColumn: change.range.startColumn - 1, endColumn: change.range.endColumn - 1, text: change.text },
                    newText
                  );
                  if (column === bp.column) continue;
                  await emu.removeBreakpoint(bp);
                  const { column: _old, ...lineBreakpoint } = bp;
                  await emu.setBreakpoint(column === undefined ? lineBreakpoint : { ...lineBreakpoint, column });
                }
              }
            }

            // --- If changed, normalize breakpoints
            await createEmuApi(messenger).normalizeBreakpoints(
              resourceName,
              editor.current.getModel()?.getLineCount() ?? -1
            );
          }
        }
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

    // --- Compile once the typing pauses (after any compile that is running now)
    compileScheduler.current?.requestAfterEdit();
  };

  /** What the margin menu's actions do, over the same calls the gutter's own gestures make. */
  const marginActionPorts = {
    add: async (bp: BreakpointInfo) => {
      await addBreakpoint(messenger, bp);
    },
    remove: async (bp: BreakpointInfo) => {
      await removeBreakpoint(messenger, bp);
    },
    enable: async (bp: BreakpointInfo, enabled: boolean) => {
      await emuApi.enableBreakpoint(bp, enabled);
    },
    resetHits: async (bp: BreakpointInfo) => {
      await emuApi.resetBreakpointHits(bp);
    },
    resolve: async () => {
      await refreshSourceCodeBreakpoints(store, messenger);
      store.dispatch(incBreakpointsVersionAction());
    },
    edit: (bp: BreakpointInfo, focus: "condition" | "hitCount" | "logMessage") =>
      openBreakpointDialog(bp, { focus }),
    setCommentsEnabled: async (bps: BreakpointInfo[], enabled: boolean) => {
      await setCommentBreakpointsEnabled(emuApi, bps, enabled);
      store.dispatch(incBreakpointsVersionAction());
    },
    showInDisassembly: async (address: number) => {
      await ideCommandsService.executeCommand(`show-disass $${address.toString(16).padStart(4, "0")}`);
    }
  };

  // --- render the editor when monaco has been initialized
  return isMonacoInitialized() ? (
    <>
    <AutoSizer>
      {({ width, height }) => (
        <Editor
          options={{
            fontSize: editorFontSize,
            // --- Chosen in View | Editor Options | Font Family; defaults to the bundled
            // --- Iosevka, whose 0.5em glyphs fit noticeably more columns than the platform
            // --- default mono. Ligatures stay off - they are wrong in Z80 source and in
            // --- hex/disassembly listings.
            fontFamily: editorFontFamily,
            fontLigatures: false,
            readOnly: document.isReadOnly || (isProjectDebugging && document.isLocked),
            glyphMargin: languageInfo?.supportsBreakpoints,
            "semanticHighlighting.enabled": true,
            overviewRulerBorder: true,
            // --- Hovers, suggestions and parameter hints may extend past the editor (a wide hover
            // --- near the left edge is shifted left of it); in the editor's own DOM the document
            // --- panel clips that part, so they are drawn in Monaco's fixed overflow layer instead
            fixedOverflowWidgets: true
          }}
          loading=""
          width={width}
          height={height}
          key={document.id}
          language={languageOverride ?? document.language}
          theme={monacoTheme}
          defaultValue={value}
          path={document.id}
          keepCurrentModel={true}
          onMount={onMount}
          onChange={onValueChanged}
        />
      )}
    </AutoSizer>
    <ContextMenu state={marginMenuState} onClickOutside={() => marginMenuApi.conceal()}>
      {marginTarget &&
        marginMenuItems(marginTarget).map((item) => (
          <span key={item.id} style={{ display: "contents" }}>
            {item.separatorBefore && <ContextMenuSeparator />}
            <ContextMenuItem
              text={item.text}
              dangerous={item.dangerous}
              disabled={item.disabled}
              trailing={item.hint}
              clicked={() => {
                marginMenuApi.conceal();
                void runMarginAction(item.id, marginTarget, resourceName, marginActionPorts, item.address);
              }}
            />
          </span>
        ))}
    </ContextMenu>
    </>
  ) : null;

  /**
   * Takes care that the editor's breakpoint decorations are updated
   * @param breakpoints Current breakpoints
   * @param compilation Current compilations
   */
  async function refreshBreakpoints(): Promise<BreakpointInfo[]> {
    // --- Filter for source code breakpoints belonging to this resource
    const state = store.getState();
    const bps = (breakpoints.current = await getBreakpoints(messenger));

    // --- Get the active compilation result
    const compilationResult = state?.compilation?.result;

    // --- Create the array of decorators
    const decorations: Decoration[] = [];
    const editorLines = editor.current?.getModel()?.getLineCount() ?? null;

    // --- Iterate through all breakpoins using this file's resource name as a filter
    const resourceName = getResourceName();
    bps.forEach(async (bp) => {
      /*
       * A `LOGPOINT` comment's logpoint (`.plans/LOGPOINTS_PLAN.md` §4.5): the hollow diamond on
       * its line, read-only. A user breakpoint on the same line owns the margin - Monaco merges a
       * line's glyph classes into one box, and the comment's mask would reshape the user's dot - so
       * the comment then shows only in the hover.
       */
      if (isAnnotationBreakpoint(bp)) {
        const userBpHere = bps.some(
          (b) =>
            !isAnnotationBreakpoint(b) &&
            b.resource === bp.resource &&
            b.line === bp.line &&
            b.column === undefined
        );
        const drawnAlready = bps.find(
          (b) => isAnnotationBreakpoint(b) && b.resource === bp.resource && b.line === bp.line
        );
        if (
          editorLines !== null &&
          bp.resource === resourceName.slice(1) &&
          bp.line <= editorLines &&
          !userBpHere &&
          drawnAlready === bp
        ) {
          decorations.push(createBinaryBreakpointDecoration(bp.line, !!bp.disabled, bp));
        }
        return;
      }
      let unreachable = true;
      if (
        compilationResult?.errors?.every((e) => e.isWarning) &&
        isDebuggableCompilerOutput(compilationResult)
      ) {
        // --- In case of a successful compilation, test if the breakpoint is allowed
        const sep = getIsWindows() ? "\\" : "/";
        const fileIndex = compilationResult.sourceFileList.findIndex((fi) =>
          fi.filename.replaceAll(sep, "/").endsWith(resourceName)
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
                decorations.push(createBinaryBreakpointDecoration(bpInfo.line, bp.disabled, bp));
              }
            }
          }
        }
      }

      // --- Render the breakpoint according to its type and reachability (a statement breakpoint is
      // --- drawn at its statement below, not in the gutter)
      if (editorLines !== null && bp.resource === resourceName.slice(1) && bp.column === undefined) {
        if (bp.line <= editorLines) {
          let decoration: monacoEditor.editor.IModelDeltaDecoration;
          if (bp.disabled) {
            decoration = createCodeBreakpointDecoration(bp.line, true, bp);
          } else if (unreachable) {
            decoration = createUnreachableBreakpointDecoration(bp.line, bp);
          } else {
            // --- Check if there is a binary breakpoint
            const binBp = bps.find((b) => b.address === bp.resolvedAddress);
            decoration = binBp
              ? createBinaryBreakpointDecoration(bp.line, false, bp)
              : createCodeBreakpointDecoration(bp.line, false, bp);
          }
          decorations.push(decoration);
        } else if (bp.resource && bp.resource === document.node?.projectPath) {
          // --- Remove the source code breakpoint exceeding the source code range
          await removeBreakpoint(messenger, bp);
        }
      }
    });

    // --- Statement breakpoints (plan §10.3): a marker before each further statement of a line with
    // --- several, while debugging; a statement breakpoint's marker always
    if (hasSourceLevelDebug(compilationResult) && compilationResult.errors?.every((e) => e.isWarning)) {
      const info = compilationResult.sourceLevelDebug;
      const fileIndex = sourceFileIndex(info, resourceName, getIsWindows());
      if (fileIndex >= 0) {
        const debugging = !!state.emulatorState?.isDebugging;
        const own = bps.filter((bp) => bp.resource === resourceName.slice(1) && bp.column !== undefined);
        const shown = new Set<string>();
        for (const s of statementMarkers(info, fileIndex)) {
          const bp = own.find((b) => b.line === s.startLine && b.column === s.startColumn);
          if (!bp && !debugging) continue;
          decorations.push(createStatementMarkerDecoration(s.startLine, s.startColumn, bp));
          shown.add(`${s.startLine}:${s.startColumn}`);
        }
        // --- A statement breakpoint whose statement has no marker (the line's first one)
        for (const bp of own) {
          if (!shown.has(`${bp.line}:${bp.column}`)) decorations.push(createStatementMarkerDecoration(bp.line!, bp.column!, bp));
        }
      }
    }

    if (bpDecorations.current) {
      bpDecorations.current.clear();
    }
    bpDecorations.current = editor.current.createDecorationsCollection(decorations);
    return bps;
  }

  /**
   * Adds or removes the statement breakpoint at a line and 0-based column (plan §10.3): the
   * statement whose range holds the column.
   */
  /** The breakpoints `ASSERTION`/`WPMEM` comments on a line made (S12). */
  function commentBreakpointsOn(line: number): BreakpointInfo[] {
    return breakpoints.current.filter(
      (bp) =>
        bp.resource === document.node?.projectPath &&
        bp.line === line &&
        isAnnotationBreakpoint(bp)
    );
  }

  /** A click on a comment's mark: disable its breakpoints, or enable them again (S12, S3). */
  async function toggleCommentBreakpoints(line: number): Promise<void> {
    const bps = commentBreakpointsOn(line);
    if (!bps.length) return;
    await setCommentBreakpointsEnabled(emuApi, bps, bps.every((bp) => bp.disabled));
    store.dispatch(incBreakpointsVersionAction());
  }

  /**
   * What a comment's mark says on hover (S12): which instruction an assertion guards - usually the
   * next source line, which is why it is named rather than left to a jump - or what a watchpoint
   * watches.
   */
  function describeCommentMark(bps: BreakpointInfo[]): string[] {
    const lines: string[] = [];
    const result = store.getState().compilation?.result;
    for (const bp of bps) {
      if (bp.exec && bp.address !== undefined) {
        const item = isDebuggableCompilerOutput(result)
          ? result.listFileItems.find((li) => li.address === bp.address)
          : undefined;
        const fileName = item && isDebuggableCompilerOutput(result)
          ? result.sourceFileList[item.fileIndex]?.filename
          : undefined;
        const sep = getIsWindows() ? "\\" : "/";
        const sameFile = !!fileName && fileName.replaceAll(sep, "/").endsWith(getResourceName());
        const code =
          item && sameFile && item.lineNumber <= (editor.current?.getModel()?.getLineCount() ?? 0)
            ? editor.current.getModel().getLineContent(item.lineNumber).split(";")[0].trim()
            : undefined;
        const at = `$${bp.address.toString(16).toUpperCase().padStart(4, "0")}`;
        // --- An assertion is checked, a logpoint logs, before the instruction at its address
        const verb = commentKindOf(bp) === "LOGPOINT" ? "Logs" : "Checked";
        lines.push(
          code && item
            ? `${verb} before \`${code}\`, line ${item.lineNumber}, ${at}`
            : `${verb} at ${at}`
        );
      } else if (bp.annotationKind === "WPMEM" && bp.address !== undefined) {
        const from = bp.address;
        const to = from + (bp.length ?? 1) - 1;
        const hex = (v: number) => `$${v.toString(16).toUpperCase().padStart(4, "0")}`;
        lines.push(
          `Watches ${from === to ? hex(from) : `${hex(from)}-${hex(to)}`} for ${bp.memoryRead ? "reads" : "writes"}`
        );
      }
    }
    return [...new Set(lines)];
  }

  /**
   * "Stop Here Once" (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §4.2): a one-shot on the
   * statement under the cursor when the build knows statements there, else on the line. An
   * existing breakpoint there becomes a one-shot; nothing is removed.
   */
  async function stopHereOnce(line: number, column: number): Promise<void> {
    const resource = document.node?.projectPath ?? getResourceName().slice(1);
    const result = store.getState().compilation?.result;
    let statementColumn: number | undefined;
    if (hasSourceLevelDebug(result)) {
      const fileIndex = sourceFileIndex(result.sourceLevelDebug, getResourceName(), getIsWindows());
      const statement =
        fileIndex >= 0 ? statementAtColumn(result.sourceLevelDebug, fileIndex, line, column) : undefined;
      if (statement && statement.startLine === line) statementColumn = statement.startColumn;
    }
    const existing = breakpoints.current.find(
      (bp) =>
        bp.resource === resource &&
        bp.line === line &&
        bp.column === statementColumn &&
        !isAnnotationBreakpoint(bp)
    );
    if (existing?.oneShot) return;
    if (!existing && !(await canAddBreakpointAt(line))) return;
    const place: BreakpointInfo = {
      resource,
      line,
      ...(statementColumn !== undefined ? { column: statementColumn } : {}),
      exec: true
    };
    const next = oneShotToggle(existing, place);
    if ("set" in next) await addBreakpoint(messenger, next.set);
    await refreshSourceCodeBreakpoints(store, messenger);
    store.dispatch(incBreakpointsVersionAction());
  }

  async function toggleStatementBreakpoint(line: number, column: number, once = false): Promise<void> {
    const result = store.getState().compilation?.result;
    if (!hasSourceLevelDebug(result)) return;
    const fileIndex = sourceFileIndex(result.sourceLevelDebug, getResourceName(), getIsWindows());
    const statement = fileIndex >= 0 ? statementAtColumn(result.sourceLevelDebug, fileIndex, line, column) : undefined;
    if (!statement || statement.startLine !== line) return;
    const resource = document.node?.projectPath ?? getResourceName().slice(1);
    const existing = breakpoints.current.find(
      (bp) =>
        bp.resource === resource &&
        bp.line === line &&
        bp.column === statement.startColumn &&
        !isAnnotationBreakpoint(bp)
    );
    const place: BreakpointInfo = { resource, line, column: statement.startColumn, exec: true };
    if (once) {
      // --- Shift+click (O1): add a one-shot, turn a regular one into one, remove a one-shot
      const next = oneShotToggle(existing, place);
      if ("remove" in next) await removeBreakpoint(messenger, next.remove);
      else await addBreakpoint(messenger, next.set);
    } else if (existing) await removeBreakpoint(messenger, existing);
    else await addBreakpoint(messenger, place);
    await refreshSourceCodeBreakpoints(store, messenger);
    store.dispatch(incBreakpointsVersionAction());
  }

  /**
   * Handles the editor's mousemove event
   * @param e
   */
  async function handleEditorMouseMove(e: monacoEditor.editor.IEditorMouseEvent): Promise<void> {
    if (e.target?.type === 2) {
      // --- Mouse is over the margin, display the breakpoint placeholder
      const lineNo = e.target.position.lineNumber;

      // --- Check if there is an existing breakpoint at this line
      const existingBp = breakpoints.current.find(
        (bp) =>
          bp.resource === resourceName &&
          bp.line === lineNo &&
          bp.column === undefined &&
          !isAnnotationBreakpoint(bp)
      );
      // --- A comment on the line is described, never offered for removal
      const commentBp = breakpoints.current.find(
        (bp) => bp.resource === resourceName && bp.line === lineNo && isAnnotationBreakpoint(bp)
      );
      // --- An `ASSERTION`/`WPMEM` comment's mark (S12): a click toggles it, so the line need not
      // --- be able to hold a breakpoint
      const commentMarks = existingBp ? [] : commentBreakpointsOn(lineNo);
      if (!existingBp && !commentMarks.length && languageInfo?.instantSyntaxCheck) {
        // --- No existing breakpoint, alllow creating one, if the source code has anything here
        const lineContent = editor.current.getModel().getLineContent(lineNo);
        const allowBp = await createMainApi(messenger).canLineHaveBreakpoint(
          lineContent,
          languageInfo.id
        );
        if (!allowBp) {
          const message = "You cannot create a breakpoint here";
          hoverDecorations.current?.clear();
          hoverDecorations.current = editor.current.createDecorationsCollection([
            createHoverDisabledBreakpointDecoration(lineNo, message)
          ]);
          return;
        }
      }

      // --- Display the message: the gesture, the breakpoint's filters, the menu
      hoverDecorations.current?.clear();
      const message = (commentMarks.length ? [
        `Click to ${commentMarks.every((bp) => bp.disabled) ? "enable" : "disable"} this ${commentKindOf(commentMarks[0])} comment`,
        ...describeCommentMark(commentMarks),
        ...breakpointFilterLines(commentMarks[0]),
        "Right-click for more actions"
      ] : [
        `Click to ${existingBp ? "remove the existing" : "add a new"} breakpoint`,
        existingBp?.oneShot
          ? "Shift-click to remove the one-shot"
          : existingBp
            ? "Shift-click to make it stop here once"
            : "Shift-click to stop here once",
        ...(existingBp ? breakpointFilterLines(existingBp) : []),
        ...(commentBp ? breakpointFilterLines(commentBp) : []),
        "Right-click for more actions"
      ]).join("\n\n");
      hoverDecorations.current = editor.current.createDecorationsCollection([
        createHoverBreakpointDecoration(lineNo, message)
      ]);
    } else {
      // --- Mouse is out of margin, remove the breakpoint placeholder
      hoverDecorations.current?.clear();
    }
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  function handleEditorMouseLeave(_e: monacoEditor.editor.IEditorMouseEvent): void {
    hoverDecorations.current?.clear();
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  function handleEditorMouseDown(e: monacoEditor.editor.IEditorMouseEvent): void {
    const isPlainLineNumberClick =
      e.event.leftButton &&
      !e.event.altKey &&
      !e.event.ctrlKey &&
      !e.event.metaKey &&
      !e.event.shiftKey &&
      e.event.detail === 1 &&
      e.target?.type === MONACO_GUTTER_LINE_NUMBERS;

    lineNumberSelectionClick.current = isPlainLineNumberClick
      ? e.target.position.lineNumber
      : null;

    // --- An inline statement marker (plan §10.3): toggles that statement's breakpoint; Shift+click
    // --- makes it a one-shot (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` O1)
    const markerClasses = [
      styles.statementBpMarker,
      styles.statementBpSet,
      styles.statementBpDisabled,
      styles.statementBpConditional,
      styles.statementBpInactive,
      styles.statementBpOnce
    ];
    if (
      e.event.leftButton &&
      e.target?.type === MONACO_CONTENT_TEXT &&
      e.target.position &&
      markerClasses.some((c) => e.target.element?.classList.contains(c))
    ) {
      if (e.event.shiftKey) {
        // --- Before Monaco extends the selection to the click (R6)
        e.event.preventDefault();
        e.event.stopPropagation();
      }
      void toggleStatementBreakpoint(
        e.target.position.lineNumber,
        e.target.position.column - 1,
        e.event.shiftKey
      );
      return;
    }

    if (
      e.event.leftButton &&
      e.target?.type === MONACO_GUTTER_GLYPH_MARGIN
    ) {
      // --- Breakpoint glyph is clicked
      const lineNo = e.target.position.lineNumber;
      const existingBp = breakpoints.current.find(
        (bp) =>
          bp.resource === document.node?.projectPath &&
          bp.line === lineNo &&
          bp.column === undefined &&
          !isAnnotationBreakpoint(bp)
      );
      // --- A DeZog comment's mark: a click toggles its disabled state (S12; LOGPOINT too, Q6)
      const commentBp = breakpoints.current.find(
        (bp) =>
          bp.resource === document.node?.projectPath &&
          bp.line === lineNo &&
          isAnnotationBreakpoint(bp)
      );
      if (!existingBp && commentBp && !e.event.shiftKey) {
        void toggleCommentBreakpoints(lineNo);
        return;
      }
      if (e.event.shiftKey) {
        // --- Shift+click (O1). Monaco reads Shift+mousedown as "extend the selection"; the margin
        // --- click is ours (R6)
        e.event.preventDefault();
        e.event.stopPropagation();
      }
      (async () => {
        if (e.event.shiftKey && existingBp) {
          const next = oneShotToggle(existingBp, existingBp);
          if ("remove" in next) await removeBreakpoint(messenger, next.remove);
          else await addBreakpoint(messenger, next.set);
          await refreshSourceCodeBreakpoints(store, messenger);
          store.dispatch(incBreakpointsVersionAction());
        } else if (existingBp) {
          await removeBreakpoint(messenger, existingBp);
        } else if (await addCopperSourceBreakpoint(lineNo)) {
          // --- A `.copper` line on the Next: a Copper breakpoint, not an execution one (D12)
          handleEditorMouseLeave(e);
        } else {
          // --- Check if this is a valid location for a breakpoint
          let allow = !languageInfo?.instantSyntaxCheck;
          if (!allow) {
            const lineContent = editor.current.getModel().getLineContent(lineNo);
            allow = await createMainApi(messenger).canLineHaveBreakpoint(
              lineContent,
              languageInfo.id
            );
          }
          if (allow) {
            const place: BreakpointInfo = { resource: resourceName, line: lineNo, exec: true };
            await addBreakpoint(messenger, e.event.shiftKey ? asOneShot(place) : place);
            await refreshSourceCodeBreakpoints(store, messenger);
            store.dispatch(incBreakpointsVersionAction());
            handleEditorMouseLeave(e);
          }
        }
      })();
    }
  }

  /**
   * A gutter click on a `.copper` line while a ZX Spectrum Next runs: sets a `cu:` breakpoint on
   * every list index the line occupies in the live Copper RAM (`.plans/COPPER_DEBUGGING_PLAN.md`
   * D12). The `.copper` words are data the Z80 never executes, so an execution breakpoint there
   * could not fire. Returns false for any other line, which then takes the usual path.
   */
  async function addCopperSourceBreakpoint(lineNo: number): Promise<boolean> {
    if (store.getState().emulatorState?.machineId !== MI_ZXNEXT) return false;
    if (!isCopperSourceLine(editor.current.getModel().getLineContent(lineNo))) return false;
    const result = store.getState().compilation?.result as
      | { sourceFileList?: { filename: string }[]; copperBlocks?: CopperBlock[] }
      | undefined;
    const emuApi = createEmuApi(messenger);
    let indexes: number[] = [];
    try {
      const state = await emuApi.getCopperState();
      const fileIndex = copperSourceFileIndex(result?.sourceFileList, resourceName, getIsWindows());
      indexes = copperIndexesForSourceLine(state?.ram, result?.copperBlocks, fileIndex, lineNo);
    } catch {
      indexes = [];
    }
    if (!indexes.length) {
      store.dispatch(
        setIdeStatusMessageAction(
          "This .copper line is not in the Copper's RAM: build, run until the list is uploaded, then click again",
          false
        )
      );
      return true;
    }
    for (const index of indexes) {
      await emuApi.setBreakpoint({ copperIndex: index, exec: false });
    }
    store.dispatch(incBreakpointsVersionAction());
    store.dispatch(
      setIdeStatusMessageAction(
        `Copper breakpoint set on ${indexes
          .map((i) => `CU:$${i.toString(16).toUpperCase().padStart(3, "0")}`)
          .join(", ")}`,
        true
      )
    );
    return true;
  }

  /**
   * Can this line hold a breakpoint? Asked before offering to add one, as a click in the gutter does.
   */
  async function canAddBreakpointAt(lineNo: number): Promise<boolean> {
    if (!languageInfo?.instantSyntaxCheck) return true;
    const lineContent = editor.current.getModel().getLineContent(lineNo);
    return createMainApi(messenger).canLineHaveBreakpoint(lineContent, languageInfo.id);
  }

  /**
   * Right-click in the breakpoint margin or on an inline statement marker: the breakpoint menu
   * (Edit Condition..., Edit Hit Count..., Disable, Reset Hit Count, Remove; or Add, Add
   * Conditional...). Elsewhere Monaco's own context menu is left alone.
   */
  function handleEditorContextMenu(e: monacoEditor.editor.IEditorMouseEvent): void {
    if (!languageInfo?.supportsBreakpoints || !e.target?.position) return;
    const line = e.target.position.lineNumber;
    const projectPath = document.node?.projectPath;
    let column: number | undefined;

    if (e.target.type === MONACO_GUTTER_GLYPH_MARGIN) {
      column = undefined;
    } else {
      const markerClasses = [
        styles.statementBpMarker,
        styles.statementBpSet,
        styles.statementBpDisabled,
        styles.statementBpConditional,
        styles.statementBpInactive,
        styles.statementBpOnce
      ];
      if (
        e.target.type !== MONACO_CONTENT_TEXT ||
        !markerClasses.some((c) => e.target.element?.classList.contains(c))
      ) {
        return;
      }
      const result = store.getState().compilation?.result;
      if (!hasSourceLevelDebug(result)) return;
      const fileIndex = sourceFileIndex(result.sourceLevelDebug, getResourceName(), getIsWindows());
      const statement =
        fileIndex >= 0
          ? statementAtColumn(result.sourceLevelDebug, fileIndex, line, e.target.position.column - 1)
          : undefined;
      if (!statement || statement.startLine !== line) return;
      column = statement.startColumn;
    }

    e.event.preventDefault();
    e.event.stopPropagation();
    const breakpoint = breakpoints.current.find(
      (bp) =>
        bp.resource === projectPath &&
        bp.line === line &&
        bp.column === column &&
        !isAnnotationBreakpoint(bp)
    );
    // --- An `ASSERTION`/`WPMEM` comment's mark has its own menu while no user breakpoint is here
    const comments = column === undefined && !breakpoint ? commentBreakpointsOn(line) : [];
    const browserEvent = e.event.browserEvent;
    void (async () => {
      const canAdd = breakpoint ? true : await canAddBreakpointAt(line);
      setMarginTarget({ line, column, breakpoint, canAdd, comments });
      marginMenuApi.show(browserEvent as unknown as Parameters<typeof marginMenuApi.show>[0]);
    })();
  }

  /**
   * Keeps the current-line highlight on the line selected through the line-number gutter.
   * @param e
   */
  function handleEditorMouseUp(_e: monacoEditor.editor.IEditorMouseEvent): void {
    const clickedLineNumber = lineNumberSelectionClick.current;
    lineNumberSelectionClick.current = null;

    if (!clickedLineNumber || !editor.current) {
      return;
    }

    const model = editor.current.getModel();
    const normalizedSelection = getNormalizedLineNumberSelection(
      editor.current.getSelection(),
      clickedLineNumber,
      model?.getLineCount() ?? 0
    );

    if (normalizedSelection) {
      editor.current.setSelection(normalizedSelection, "line-number-selection");
    }
  }

  /**
   * Gets the resource name of this document
   */
  function getResourceName(): string {
    const projPath = store.getState().project?.folderPath;
    // --- A document outside the project (a Klive BASIC library file) is named by its whole id
    return projPath && document.id.startsWith(projPath) ? document.id.substring(projPath.length) : document.id;
  }

  /**
   * Refreshes the current breakpoint
   * @returns
   */
  /** The calling statement of the outer frame selected in the Call Stack panel, when it is in this document. */
  async function selectedFrameDecoration(info: SourceLevelDebugInfo, stop: SourceStopInfo | undefined): Promise<Decoration | undefined> {
    const frame = store.getState().ideView?.sourceFrame ?? 0;
    if (frame <= 0) return undefined;
    let chain: SourceActivationInfo[] | undefined;
    try {
      chain = await emuApi.getSourceCallStack();
    } catch {
      return undefined;
    }
    const row = chain ? buildSourceCallStack(info, chain, stop).find((r) => !("runtime" in r) && r.frame === frame) : undefined;
    if (!row || "runtime" in row || !row.filename || row.line === undefined) return undefined;
    const sep = getIsWindows() ? "\\" : "/";
    if (!row.filename.replaceAll(sep, "/").endsWith(getResourceName())) return undefined;
    return {
      range: new monacoEditor.Range(row.line, (row.startColumn ?? 0) + 1, row.endLine ?? row.line, (row.endColumn ?? 0) + 1),
      options: {
        className: styles.selectedFrameStatement,
        hoverMessage: { value: `Frame ${frame}: ${row.name} is running a call made here` }
      }
    };
  }

  async function refreshCurrentBreakpoint(bps: BreakpointInfo[]): Promise<void> {
    // --- No editor, no decorations
    if (!editor.current) {
      return;
    }

    // --- No output with debug information, no decorations
    if (!isDebuggableCompilerOutput(compilation.result)) {
      return;
    }

    // --- Store the decorations
    const decorations: Decoration[] = [];
    stepTargetActions.current.forEach((d) => d.dispose());
    stepTargetActions.current = [];

    // --- Get the current PC value
    const cpuStateResponse = await emuApi.getCpuState();
    const pc = cpuStateResponse.pc;
    // --- PC's partition: which of several banked sources sharing the address runs (plan §10.4)
    const where = {
      partition: (cpuStateResponse as { pcPartition?: number }).pcPartition,
      machineId: store.getState().emulatorState?.machineId
    };

    // --- Is the machine running?
    const machineState = store.getState().emulatorState?.machineState;
    // --- In the past (LITE_STEP_BACK_PLAN D7): the historical marker replaces the current one, and
    // --- what belongs to the present's stop (its source report, step-into targets, frames) is left out
    const history = (cpuStateResponse as { history?: { position: number } }).history;

    // --- Source-level debug info (plan §10.5): the active statement's own range, and return
    // --- points, which the emulator's report of the last stop knows about
    if (machineState === MachineControllerState.Paused && hasSourceLevelDebug(compilation.result)) {
      let stop;
      try {
        stop = history ? undefined : await emuApi.getSourceStopInfo();
      } catch {
        stop = undefined;
      }
      const location = locateSource(compilation.result, pc, stop, where);
      if (location?.sourceLevel) {
        const sep = getIsWindows() ? "\\" : "/";
        if (location.filename.replaceAll(sep, "/").endsWith(getResourceName())) {
          const resName = getResourceName()?.slice(1);
          const activeBp = bps.find((bp) => (bp.line === location.line && bp.resource === resName) || bp.address === pc);
          if (history) {
            decorations.push(asHistoricalDecoration(createCurrentStatementDecoration(location, activeBp), history.position));
            execPointDecoration.current?.clear();
            execPointDecoration.current = editor.current.createDecorationsCollection(decorations);
            return;
          }
          decorations.push(createCurrentStatementDecoration(location, activeBp));
          const justMyCode = getGlobalSetting(store, SETTING_EMU_JUST_MY_CODE) !== false;
          stepIntoTargets(compilation.result.sourceLevelDebug, stop, justMyCode).forEach((target, i) => {
            stepTargetActions.current.push(
              editor.current.addAction({
                id: `klive.stepIntoTarget.${target.callableIndex}`,
                label: `Step Into ${target.name}`,
                contextMenuGroupId: "klive-debug",
                contextMenuOrder: 3 + i,
                run: () => void emuApi.sourceStep("intoTarget", { targetCallable: target.callableIndex })
              })
            );
          });
        }
        // --- An outer frame selected in the Call Stack panel (§10.6): its calling statement
        const frameDecoration = await selectedFrameDecoration(compilation.result.sourceLevelDebug, stop);
        if (frameDecoration) decorations.push(frameDecoration);
        execPointDecoration.current?.clear();
        execPointDecoration.current = editor.current.createDecorationsCollection(decorations);
        return;
      }
    }

    if (
      machineState === MachineControllerState.Running ||
      machineState == MachineControllerState.Paused
    ) {
      // --- Does this file contains the default breakpoint?
      const sep = getIsWindows() ? "\\" : "/";
      const fileIndex = compilation.result.sourceFileList.findIndex((fi) =>
        fi.filename.replaceAll(sep, "/").endsWith(getResourceName())
      );
      if (fileIndex >= 0) {
        // --- We have address information for this source code file
        // --- Get source map information
        const sourceMapInfo = compilation.result.sourceMap[pc];

        // --- Check for the active breakpoint line (in PC's partition, for banked sources)
        const itemsAtPc = listItemsAtPc(compilation.result, pc, where, fileIndex);
        const lineInfo = itemsAtPc.find((li) => !li.isMacroInvocation);

        if (lineInfo) {
          const resName = getResourceName()?.slice(1);
          const activeBp = bps.find(
            (bp) =>
              (bp.line === lineInfo.lineNumber && bp.resource === resName) || bp.address === pc
          );
          decorations.push(
            createCurrentBreakpointDecoration(
              languageInfo.fullLineBreakpoints,
              lineInfo.lineNumber,
              sourceMapInfo?.startColumn,
              sourceMapInfo?.endColumn,
              activeBp
            )
          );
        }

        // --- Check for active macro invocation line
        const macroInvocationlineInfo = itemsAtPc.find((li) => li.isMacroInvocation);

        if (macroInvocationlineInfo) {
          const resName = getResourceName()?.slice(1);
          const activeBp = bps.find(
            (bp) =>
              (bp.line === macroInvocationlineInfo.lineNumber && bp.resource === resName) ||
              bp.address === pc
          );
          decorations.push(
            createCurrentMacroInvocationBreakpointDecoration(
              languageInfo.fullLineBreakpoints,
              macroInvocationlineInfo.lineNumber,
              sourceMapInfo?.startColumn,
              sourceMapInfo?.endColumn,
              activeBp
            )
          );
        }
      }
    }

    if (execPointDecoration.current) {
      execPointDecoration.current.clear();
    }
    execPointDecoration.current = editor.current.createDecorationsCollection(
      history ? decorations.map((d) => asHistoricalDecoration(d, history.position)) : decorations
    );
  }
};

/**
 * The execution marker in the past (`.plans/LITE_STEP_BACK_PLAN.md` D7, Q1): outlined in the
 * secondary accent instead of the solid current-line fill, with a hollow arrow in the gutter, so a
 * historical point is never mistaken for where the machine is.
 */
function asHistoricalDecoration(decoration: Decoration, position: number): Decoration {
  const { className: _c, glyphMarginClassName: _g, after: _a, hoverMessage: _h, ...options } = decoration.options;
  return {
    ...decoration,
    options: {
      ...options,
      className: styles.historyLine,
      glyphMarginClassName: styles.historyMargin,
      hoverMessage: {
        value: `History step \u2212${position.toLocaleString("en-US")}: the registers here are from the past; memory shows the present`
      }
    }
  };
}

/**
 * Creates a code breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createCodeBreakpointDecoration(lineNo: number, disabled: boolean, bp?: BreakpointInfo): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: withFilterGlyph(
        disabled ? styles.disabledBreakpointMargin : styles.codeBreakpointMargin,
        bp
      )
    }
  };
}

/**
 * A margin glyph's class with the conditional ("=" mark) or inactive (hollow) variant added, the
 * same shapes the disassembly gutter and the Breakpoints panel draw (plan §4.4.2).
 */
function withFilterGlyph(className: string, bp?: BreakpointInfo): string {
  // --- One reading of the glyph for every surface (`breakpoint-filter-text.ts`)
  switch (breakpointGlyphOf(bp)) {
    case "inactive":
      return `${className} ${styles.inactiveBreakpointMargin}`;
    case "conditional":
      return `${className} ${styles.conditionalBreakpointMargin}`;
    case "logpoint":
      return `${className} ${styles.logpointBreakpointMargin}`;
    case "logpointConditional":
      return `${className} ${styles.logpointConditionalBreakpointMargin}`;
    case "logpointInactive":
      return `${className} ${styles.logpointInactiveBreakpointMargin}`;
    case "logpointComment":
      return `${className} ${styles.logpointCommentBreakpointMargin}`;
    case "once":
      return `${className} ${styles.onceBreakpointMargin}`;
    case "onceConditional":
      return `${className} ${styles.onceConditionalBreakpointMargin}`;
    case "assertion":
      return `${className} ${styles.assertionCommentMargin}`;
    case "watchpoint":
      return `${className} ${styles.wpmemCommentMargin}`;
    default:
      return className;
  }
}

/**
 * Creates a binary breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createBinaryBreakpointDecoration(lineNo: number, disabled: boolean, bp?: BreakpointInfo): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: withFilterGlyph(
        disabled ? styles.disabledBreakpointMargin : styles.binaryBreakpointMargin,
        bp
      )
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
 * Creates a breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createHoverDisabledBreakpointDecoration(lineNo: number, message?: string): Decoration {
  const hoverMessage: MarkdownString = message ? { value: message } : null;
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: styles.disabledHoverBreakpointMargin,
      glyphMarginHoverMessage: hoverMessage
    }
  };
}

/**
 * Creates an unreachable breakpoint decoration
 * @param lineNo Line to apply the decoration to
 * @returns
 */
function createUnreachableBreakpointDecoration(lineNo: number, bp?: BreakpointInfo): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: withFilterGlyph(styles.unreachableBreakpointMargin, bp)
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
  endColumn?: number,
  activeBp?: BreakpointInfo
): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, startColumn ?? 1, lineNo, (endColumn ?? 1) + 1),
    options: {
      isWholeLine: fullLine,
      className: styles.activeBreakpointLine,
      glyphMarginClassName: activeBp
        ? activeBp.address !== undefined
          ? styles.activeBinBreakpointOnExistingMargin
          : styles.activeBreakpointOnExistingMargin
        : styles.activeBreakpointMargin
    }
  };
}

/**
 * An inline statement marker (plan §10.3), before a statement that shares its line: faint where a
 * breakpoint can go, in the breakpoint colour where one is set.
 */
function createStatementMarkerDecoration(line: number, column: number, bp?: BreakpointInfo): Decoration {
  const className = bp
    ? bp.disabled
      ? styles.statementBpDisabled
      : isInactiveBreakpoint(bp)
        ? styles.statementBpInactive
        : bp.oneShot
          ? styles.statementBpOnce
          : isConditionalBreakpoint(bp)
            ? styles.statementBpConditional
            : styles.statementBpSet
    : styles.statementBpMarker;
  // --- The glyph carries the variant, as in the margin: a hollow dot for an inactive breakpoint, a
  // --- circled "1" for a one-shot (inactive still wins, O6), a circled "=" for a conditional one
  const content =
    bp && isInactiveBreakpoint(bp)
      ? "\u25cb"
      : bp?.oneShot
        ? "\u2460"
        : bp && isConditionalBreakpoint(bp)
          ? "\u229c"
          : "\u25cf";
  const hover = bp
    ? [
        "Click to remove the breakpoint on this statement",
        bp.oneShot ? "Shift-click to remove the one-shot" : "Shift-click to make it stop here once",
        ...breakpointFilterLines(bp),
        "Right-click for more actions"
      ]
    : [
        "Click to add a breakpoint on this statement",
        "Shift-click to stop here once",
        "Right-click for more actions"
      ];
  // --- The range covers the statement's first character: Monaco (0.55) draws no `before` text for
  // --- a decoration with an empty range, so an empty one left every marker invisible
  return {
    range: new monacoEditor.Range(line, column + 1, line, column + 2),
    options: {
      before: { content, inlineClassName: className },
      hoverMessage: { value: hover.join("\n\n") }
    }
  };
}

/**
 * The execution point at source level (plan §10.3, §10.5): exactly the active statement, across
 * its lines; at a return point the calling statement, with a note naming the routine that returned.
 */
function createCurrentStatementDecoration(location: SourceLocation, activeBp?: BreakpointInfo): Decoration {
  const startColumn = (location.startColumn ?? 0) + 1;
  const endColumn = location.endColumn !== undefined ? location.endColumn + 1 : startColumn;
  const returnPoint = location.kind === "returnPoint";
  const note = returnPoint ? `returned from ${location.returnedFrom ?? "a call"}` : undefined;
  const error = location.kind === "error" ? (location.error ?? "runtime error") : undefined;
  return {
    range: new monacoEditor.Range(location.line, startColumn, location.endLine, endColumn),
    options: {
      className: styles.activeBreakpointLine,
      glyphMarginClassName: activeBp
        ? activeBp.address !== undefined
          ? styles.activeBinBreakpointOnExistingMargin
          : styles.activeBreakpointOnExistingMargin
        : styles.activeBreakpointMargin,
      ...(note
        ? {
            hoverMessage: { value: `Execution returned here: ${note}` },
            after: { content: `  \u2190 ${note}`, inlineClassName: styles.returnPointNote }
          }
        : {}),
      ...(error
        ? {
            hoverMessage: { value: `The program stopped on a runtime error: ${error}. Continue to let the ROM report it.` },
            after: { content: `  \u2716 ${error}`, inlineClassName: styles.errorStopNote }
          }
        : {})
    }
  };
}

/**
 * Creates a current breakpoint decoration
 * @param lineNo Line to apply the decoration to
 * @returns
 */
function createCurrentMacroInvocationBreakpointDecoration(
  fullLine: boolean,
  lineNo: number,
  startColumn?: number,
  endColumn?: number,
  activeBp?: BreakpointInfo
): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, startColumn ?? 1, lineNo, (endColumn ?? 1) + 1),
    options: {
      isWholeLine: fullLine,
      className: styles.activeMacroInvocationLine,
      glyphMarginClassName: activeBp
        ? activeBp.address !== undefined
          ? styles.activeMacroBinBreakpointOnExistingMargin
          : styles.activeMacroBreakpointOnExistingMargin
        : styles.activeMacroBreakpointMargin
    }
  };
}

/**
 * Starts a background compile of the current project's build root. Resolves to false only when the
 * main process refuses because a compile is already running (the scheduler then retries after it);
 * true otherwise, including when there is nothing to compile.
 */
async function startBackgroundCompile(
  store: Store<AppState>,
  mainApi: ReturnType<typeof createMainApi>,
  allowCompile: boolean = true,
  activeDocument?: { id: string; language: string }
): Promise<boolean> {
  // --- Check if we have a build root to compile
  const state = store.getState();
  if (!state.project?.isKliveProject) {
    return true;
  }
  // --- The open `.zxbas` file gets Klive BASIC intel even when the build root does not include it
  // --- (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md` E14); without a build root it is checked itself
  const basicActiveFile =
    activeDocument?.language === "zxbas" &&
    !activeDocument.id.startsWith("<") &&
    selectedZxBasicCompiler(state) === "klive"
      ? activeDocument.id
      : undefined;
  const buildRoot = state.project.buildRoots?.[0];
  if (!buildRoot && !basicActiveFile) {
    return true;
  }
  const fullPath = buildRoot ? `${state.project.folderPath}/${buildRoot}` : basicActiveFile!;
  const language = buildRoot ? getFileTypeEntry(fullPath, store)?.subType : "zxbas";

  // --- The built-in compilers (the Klive Z80 assembler, and Klive BASIC unless `zxbasic.compiler`
  // --- selects zxbc) always run background compilation; the flag only gates external compilers
  // --- (zxbc, SjasmPlus, etc.)
  const langInfo = customLanguagesRegistry.find((l) => l.id === language);
  const isBuiltInCompiler =
    langInfo?.compiler === "Z80Compiler" ||
    (language === "zxbas" && selectedZxBasicCompiler(state) === "klive");
  if (!allowCompile && !isBuiltInCompiler) {
    return true;
  }

  // --- Compile the build root. A refusal leaves the flag to the compile that is running, whose
  // --- end clears it; a failed request clears it here, or no later request would ever start.
  store.dispatch(startBackgroundCompileAction());
  try {
    return await mainApi.startBackgroundCompile(fullPath, language, undefined, basicActiveFile ? { basicActiveFile } : undefined);
  } catch (err) {
    store.dispatch(resetBackgroundCompileAction());
    reportError(err);
    return true;
  }
}
