import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { MonacoEditor } from "./MonacoEditor";

export const createTextEditorPanel = ({ document, contents, apiLoaded }: DocumentProps) => {
  return (
    <MonacoEditor
      key={document.id}
      document={document}
      value={contents as string}
      apiLoaded={apiLoaded}
      languageOverride="plaintext"
    />
  );
};
