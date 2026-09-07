import { DataPanel, PanelHeader } from "@renderer/controls/data";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const NxiFileEditorPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".NXI Editor" />
    </DataPanel>
  );
};

export const createNxiFileEditorPanel = ({ document, contents }: DocumentProps) => (
  <NxiFileEditorPanel document={document} contents={contents} apiLoaded={() => {}} />
);
