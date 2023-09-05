import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { MonacoEditor } from "./MonacoEditor";

export const createCodeEditorPanel = ({ document, data, apiLoaded }: DocumentProps) => {
  return (
    <MonacoEditor
      key={document.id}
      document={document}
      value={data}
      apiLoaded={apiLoaded}
    />
  );
};
