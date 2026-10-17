import { DataPanel, EmptyState, PanelHeader } from "@renderer/controls/data";
import { notImplementedMessage } from "./notImplemented";
import { useT } from "@common/i18n/useT";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const VidFileViewerPanel = ({}: DocumentProps) => {
  const t = useT();
  return (
    <DataPanel>
      <PanelHeader title={t("panels.next.viewerTitle", { extension: ".VID" })} />
      <EmptyState message={notImplementedMessage()} />
    </DataPanel>
  );
};

export const createVidFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <VidFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
