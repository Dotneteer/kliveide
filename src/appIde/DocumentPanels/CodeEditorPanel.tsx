import { DocumentState } from "../../../common/abstractions/DocumentState";

const CodeEditorPanel = (props: DocumentState) => {
  return <div>CodeEditor {props.name}</div>;
};

export const createCodeEditorPanel = (props: DocumentState) => {
  return <CodeEditorPanel name={props.name} id={""} type={""} />
};
