import { DataPanel, EmptyState, PanelHeader } from "@renderer/controls/data";
import { NOT_IMPLEMENTED_MESSAGE } from "./notImplemented";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const NxiFileEditorPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".NXI Editor" />
      <EmptyState message={NOT_IMPLEMENTED_MESSAGE} />
    </DataPanel>
  );
};

export const createNxiFileEditorPanel = ({ document, contents }: DocumentProps) => (
  <NxiFileEditorPanel document={document} contents={contents} apiLoaded={() => {}} />
);
