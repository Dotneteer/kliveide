import { DocumentProps } from "../DocumentArea/DocumentsContainer";

const CodeEditorPanel = ({ document }: DocumentProps) => {
  return <div style={{color: "white"}}>CodeEditor {document.name} {document.iconFill}</div>;
};

export const createCodeEditorPanel = ({ document }: DocumentProps) => {
  return <CodeEditorPanel document={document} />
};
