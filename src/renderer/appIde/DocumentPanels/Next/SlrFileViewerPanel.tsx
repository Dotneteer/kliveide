import { DataPanel, PanelHeader } from "@renderer/controls/data";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const SlrFileViewerPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".SLR Viewer" />
    </DataPanel>
  );
};

export const createSlrFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <SlrFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
