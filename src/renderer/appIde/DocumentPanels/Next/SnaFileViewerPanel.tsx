import { DataPanel, PanelHeader } from "@renderer/controls/data";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const SnaFileViewerPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".SNA Viewer" />
    </DataPanel>
  );
};

export const createSnaFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <SnaFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
