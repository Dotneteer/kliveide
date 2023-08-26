import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { MonacoEditor } from "./MonacoEditor";

export const createCodeEditorPanel = ({ document, data, viewState, apiLoaded }: DocumentProps) => {
  return (
    <MonacoEditor
      key={document.id}
      document={document}
      value={data}
      viewState={viewState}
      apiLoaded={apiLoaded}
    />
  );
};
