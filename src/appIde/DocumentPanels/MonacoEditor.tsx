import Editor, { loader } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import AutoSizer from "@/lib/react-virtualized-auto-sizer";
import { useTheme } from "@/theming/ThemeProvider";
import { useEffect, useRef, useState } from "react";
import { useRendererContext, useSelector } from "@/core/RendererProvider";
import { MainGetAppFolderResponse } from "@common/messaging/any-to-main";
import { CodeDocumentState } from "../services/DocumentService";
import { useAppServices } from "../services/AppServicesProvider";
import { DocumentState } from "@common/abstractions/DocumentState";
import { customLanguagesRegistry } from "@/registry";
import { MonacoAwareCustomLanguageInfo } from "../abstractions/CustomLanguageInfo";

// --- Wait 1000 ms before saving the document being edited
const SAVE_DEBOUNCE = 1000;

// --- Take care of initializing the editor only once
let initialized = false;

type EditorProps = {
  document: DocumentState;
  value: string;
  viewState?: monacoEditor.editor.ICodeEditorViewState;
};

export const MonacoEditor = ({ document, value, viewState }: EditorProps) => {
  const { theme } = useTheme();
  const { messenger } = useRendererContext();
  const { documentService } = useAppServices();
  const [vsTheme, setVsTheme] = useState("");
  const editor = useRef<monacoEditor.editor.IStandaloneCodeEditor>(null);
  const monaco = useRef<typeof monacoEditor>(null);
  const languageInfo = useRef<MonacoAwareCustomLanguageInfo>(null);
  const docActivationVersion = useSelector(
    s => s.ideView?.documentActivationVersion
  );
  const previousContent = useRef<string>();
  const unsavedChangeCounter = useRef(0);

  // --- Initialize the monaco editor when used first
  useEffect(() => {
    if (initialized) return;
    (async () => {
      initialized = true;
      const response = (await messenger.sendMessage({
        type: "MainGetAppFolder"
      })) as MainGetAppFolderResponse;
      const monacoFolder = `${response.path}/node_modules/monaco-editor/min/vs`;
      loader.config({
        paths: {
          vs: monacoFolder
        }
      });
      await loader.init();
    })();
  });

  // --- Set the editor focus, whenever the activation version changes
  useEffect(() => {
    editor.current?.focus();
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
  }, [theme])

  // --- Ensures that the document language is initializes
  const ensureLanguage = (monaco: typeof monacoEditor, language: string) => {
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
  };

  // --- Initializes languages before mounting the editor
  const beforeMount = (monaco: typeof monacoEditor) => {
    ensureLanguage(monaco, document.language);
  };

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
    ed.focus();

    // --- Mount events to save the view state
    const disposables: monacoEditor.IDisposable[] = [];
    disposables.push(
      ed.onDidBlurEditorText(saveDocumentState),
      ed.onDidBlurEditorWidget(saveDocumentState),
      ed.onDidChangeCursorPosition(saveDocumentState),
      ed.onDidChangeCursorSelection(saveDocumentState),
      ed.onDidChangeHiddenAreas(saveDocumentState),
      ed.onDidFocusEditorText(saveDocumentState),
      ed.onDidFocusEditorWidget(saveDocumentState)
    );

    // --- Dispose event handlers
    editor.current.onDidDispose(() => {
      disposables.forEach(d => d.dispose());
    });
  };

  // --- Saves the document state
  const saveDocumentState = () => {
    const data: CodeDocumentState = {
      value: editor.current.getValue(),
      viewState: editor.current.saveViewState()
    };
    documentService.setDocumentData(document.id, data);
  };

  /**
   * Saves the document to its file
   * @param documentText Document text to save
   */
  const saveDocumentToFile = async (documentText: string): Promise<void> => {
    const result = await messenger.sendMessage({
      type: "MainSaveTextFile",
      path: document.id,
      data: documentText
    });
    if (result.type === "ErrorResponse") {
      console.error("Error");
    }
  };

  // --- Handle document changes
  const onValueChanged = async (val: any) => {
    // --- Save the current value as the previous one
    previousContent.current = editor.current.getValue();

    // --- Save document after the change (with delay)
    unsavedChangeCounter.current++;
    await new Promise(r => setTimeout(r, SAVE_DEBOUNCE));
    if (unsavedChangeCounter.current === 1 && previousContent.current) {
      await saveDocumentToFile(editor.current.getModel().getValue());
    }
    unsavedChangeCounter.current--;
  };

  return (
    <AutoSizer>
      {({ width, height }) => (
        <Editor
          options={{
            fontSize: 14
          }}
          loading=''
          width={width}
          height={height}
          key={document.id}
          language={document.language}
          theme={vsTheme}
          value={value}
          beforeMount={beforeMount}
          onMount={onMount}
          onChange={onValueChanged}
        />
      )}
    </AutoSizer>
  );
};
