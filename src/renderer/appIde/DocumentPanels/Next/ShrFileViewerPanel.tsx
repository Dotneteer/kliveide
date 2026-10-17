import { DataPanel, EmptyState, PanelHeader } from "@renderer/controls/data";
import { notImplementedMessage } from "./notImplemented";
import { useT } from "@common/i18n/useT";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const ShrFileViewerPanel = ({}: DocumentProps) => {
  const t = useT();
  return (
    <DataPanel>
      <PanelHeader title={t("panels.next.viewerTitle", { extension: ".SHR" })} />
      <EmptyState message={notImplementedMessage()} />
    </DataPanel>
  );
};

export const createShrFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <ShrFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
