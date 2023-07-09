import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { useAppServices } from "../services/AppServicesProvider";
import { MonacoEditor } from "./MonacoEditor";

export const createCodeEditorPanel = ({ document, data }: DocumentProps) => {
  const { documentService } = useAppServices();
  return (
    <MonacoEditor
      document={document}
      value={data?.value}
      viewState={data?.viewState}
      apiLoaded={(api) => documentService.setDocumentApi(document.id, api)}
    />
  );
};
