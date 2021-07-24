import * as React from "react";
import { CSSProperties } from "styled-components";
import {
  DocumentPanelDescriptorBase,
  IDocumentPanel,
} from "../document-area/DocumentService";
import MonacoEditor from "react-monaco-editor";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";

/**
 * Component properties
 */
interface Props {
  descriptor: IDocumentPanel;
}

/**
 * Component state
 */
interface State {
  code: string;
}

/**
 * A sample document
 */
export default class EditorDocument extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      code: "// My code",
    };
  }

  editorDidMount(
    editor: monacoEditor.editor.IStandaloneCodeEditor,
    monaco: typeof monacoEditor
  ) {
    editor.focus();
  }

  onChange(newValue: string, e: monacoEditor.editor.IModelContentChangedEvent) {
  }

  componentDidMount(): void {}

  render() {
    const placeholderStyle: CSSProperties = {
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      flexShrink: 1,
      width: "100%",
      height: "100%",
      padding: "4px 0 0 0",
    };
    const code = this.state.code;
    const options = {
      selectOnLineNumbers: true,
    };
    return (
      <div style={placeholderStyle}>
        <MonacoEditor
          language="javascript"
          theme="vs-dark"
          value={code}
          options={options}
          onChange={(value, e) => this.onChange(value, e)}
          editorDidMount={(editor, monaco) =>
            this.editorDidMount(editor, monaco)
          }
        />
      </div>
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
  ) {
    super(id, title);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <EditorDocument descriptor={this} />;
  }
}
