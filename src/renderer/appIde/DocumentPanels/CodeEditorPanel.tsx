import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { MonacoEditor } from "./MonacoEditor";

export const createCodeEditorPanel = ({ document, data, apiLoaded }: DocumentProps) => {
  return (
    <MonacoEditor
      document={document}
      value={data?.value}
      viewState={data?.viewState}
      apiLoaded={apiLoaded}
    />
  );
};
