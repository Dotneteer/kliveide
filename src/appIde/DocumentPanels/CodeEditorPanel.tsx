import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { MonacoEditor } from "./MonacoEditor";

export const createCodeEditorPanel = ({ document, data }: DocumentProps) => {
  return <MonacoEditor path={document.id} value={data.value} viewState={data.viewState} />;
};
