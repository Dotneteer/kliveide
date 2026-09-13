import { DataPanel, PanelHeader } from "@renderer/controls/data";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const Sl2FileViewerPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".SL2 Viewer" />
    </DataPanel>
  );
};

export const createSl2FileViewerPanel = ({ document, contents }: DocumentProps) => (
  <Sl2FileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
