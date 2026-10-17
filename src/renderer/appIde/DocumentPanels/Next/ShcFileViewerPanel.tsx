import { DataPanel, EmptyState, PanelHeader } from "@renderer/controls/data";
import { notImplementedMessage } from "./notImplemented";
import { useT } from "@common/i18n/useT";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const ShcFileViewerPanel = ({}: DocumentProps) => {
  const t = useT();
  return (
    <DataPanel>
      <PanelHeader title={t("panels.next.viewerTitle", { extension: ".SHC" })} />
      <EmptyState message={notImplementedMessage()} />
    </DataPanel>
  );
};

export const createShcFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <ShcFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
