import * as React from "react";
import { CSSProperties } from "styled-components";
import MonacoEditor from "react-monaco-editor";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import ReactResizeDetector from "react-resize-detector";
import { editorService } from "./editorService";
import {
  DocumentPanelDescriptorBase,
  IDocumentPanel,
} from "../document-area/DocumentFactory";
import { documentService } from "../document-area/DocumentService";

/**
 * Component properties
 */
interface Props {
  descriptor: IDocumentPanel;
  sourceCode: string;
  language: string;
}

/**
 * Component state
 */
interface State {
  width: string;
  height: string;
  show: boolean;
}

/**
 * A sample document
 */
export default class EditorDocument extends React.Component<Props, State> {
  private divHost = React.createRef<HTMLDivElement>();
  private _editor: monacoEditor.editor.IStandaloneCodeEditor;

  constructor(props: Props) {
    super(props);
    this.state = {
      width: "100%",
      height: "100%",
      show: false,
    };
  }

  editorWillMount(monaco: typeof monacoEditor): void {
    if (
      !monaco.languages
        .getLanguages()
        .some(({ id }) => id === this.props.language)
    ) {
      console.log(`New language: ${this.props.language}`)
      const languageInfo = documentService.getCustomLanguage(
        this.props.language
      );
      console.log(languageInfo);
      if (languageInfo) {
        // --- Register a new language
        monaco.languages.register({ id: languageInfo.id });
        // --- Register a tokens provider for the language
        monaco.languages.setMonarchTokensProvider(
          languageInfo.id,
          languageInfo.languageDef
        );
        // Set the editing configuration for the language
        monaco.languages.setLanguageConfiguration(
          languageInfo.id,
          languageInfo.options
        );
        monaco.editor.defineTheme("myTheme", {
          base: "vs-dark",
          inherit: true,
          rules: [{
            token: "escapes",
            foreground: 'ffff00'
          }],
          colors: {}
        })
      }
    }
  }

  editorDidMount(
    editor: monacoEditor.editor.IStandaloneCodeEditor,
    monaco: typeof monacoEditor
  ) {
    monaco.languages.setMonarchTokensProvider;
    this._editor = editor;
    const state = editorService.loadState(this.props.descriptor.id);
    if (state) {
      this._editor.setValue(state.text);
      this._editor.restoreViewState(state.viewState);
    }
    window.requestAnimationFrame(() => this._editor.focus());
  }

  onChange(
    newValue: string,
    e: monacoEditor.editor.IModelContentChangedEvent
  ) {}

  componentDidMount(): void {
    this.setState({ show: true });
  }

  componentWillUnmount(): void {
    editorService.saveState(this.props.descriptor.id, {
      text: this._editor.getValue(),
      viewState: this._editor.saveViewState(),
    });
  }

  render() {
    const placeholderStyle: CSSProperties = {
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      flexShrink: 1,
      width: "100%",
      height: "100%",
      overflow: "hidden",
    };
    const options = {
      selectOnLineNumbers: true,
    };
    return (
      <>
        <div ref={this.divHost} style={placeholderStyle}>
          {this.state.show && (
            <MonacoEditor
              language={this.props.language}
              theme="myTheme"
              value={this.props.sourceCode}
              options={options}
              onChange={(value, e) => this.onChange(value, e)}
              editorWillMount={(editor) => this.editorWillMount(editor)}
              editorDidMount={(editor, monaco) =>
                this.editorDidMount(editor, monaco)
              }
            />
          )}
        </div>
        <ReactResizeDetector
          handleWidth
          handleHeight
          onResize={() => {
            this._editor.layout();
          }}
        />
      </>
    );
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class EditorDocumentPanelDescriptor extends DocumentPanelDescriptorBase {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly language: string,
    public readonly contents: string
  ) {
    super(id, title);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return (
      <EditorDocument
        descriptor={this}
        sourceCode={this.contents}
        language={this.language}
      />
    );
  }
}
