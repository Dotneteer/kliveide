import { DataPanel, PanelHeader } from "@renderer/controls/data";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const ShcFileViewerPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".SHC Viewer" />
    </DataPanel>
  );
};

export const createShcFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <ShcFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
