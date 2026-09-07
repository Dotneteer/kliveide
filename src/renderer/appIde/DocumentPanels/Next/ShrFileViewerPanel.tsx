import { DataPanel, PanelHeader } from "@renderer/controls/data";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const ShrFileViewerPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".SHR Viewer" />
    </DataPanel>
  );
};

export const createShrFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <ShrFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
