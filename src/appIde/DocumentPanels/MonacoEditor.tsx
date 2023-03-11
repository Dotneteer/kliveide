import Editor, { loader } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import AutoSizer from "@/lib/react-virtualized-auto-sizer";
import { useTheme } from "@/theming/ThemeProvider";
import { useEffect, useRef } from "react";
import { useRendererContext, useSelector } from "@/core/RendererProvider";
import { MainGetAppFolderResponse } from "@common/messaging/any-to-main";
import { CodeDocumentState } from "../services/DocumentService";
import { useAppServices } from "../services/AppServicesProvider";
import { DocumentState } from "@common/abstractions/DocumentState";

// --- Take care of initializing the editor only once
let initialized = false;

type EditorProps = {
  document: DocumentState;
  value: string;
  viewState?: monacoEditor.editor.ICodeEditorViewState;
};

export const MonacoEditor = ({ document, value, viewState }: EditorProps) => {
  const editor = useRef<monacoEditor.editor.IStandaloneCodeEditor>(null);
  const monaco = useRef<typeof monacoEditor>(null);
  const { theme } = useTheme();
  const { messenger } = useRendererContext();
  const { documentService } = useAppServices();
  const docActivationVersion = useSelector(s => s.ideView?.documentActivationVersion)

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

  useEffect(() => {
    editor.current?.focus();
  }, [docActivationVersion]);

  // --- Initializes the editor when mounted
  const onMount = (
    ed: monacoEditor.editor.IStandaloneCodeEditor,
    mon: typeof monacoEditor
  ): void => {
    editor.current = ed;
    monaco.current = mon;
    if (viewState) {
      console.log("restored", viewState);
      ed.restoreViewState(viewState);
    }
    ed.focus();
    console.log("events mounted");
    editor.current.onDidDispose(() => {
      console.log("events disposed");
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

  const onValueChanged = (val: any) => {
    saveDocumentState();
  };

  return (
    <AutoSizer>
      {({ width, height }) => (
        <Editor
          options={{
            fontSize: 14
          }}
          loading=""
          width={width}
          height={height}
          key={document.id}
          language={"json"}
          theme={theme?.tone === "light" ? "light" : "vs-dark"}
          value={value}
          onMount={onMount}
          onChange={onValueChanged}
        />
      )}
    </AutoSizer>
  );
};
