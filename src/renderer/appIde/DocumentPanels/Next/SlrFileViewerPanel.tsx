import { DataPanel, EmptyState, PanelHeader } from "@renderer/controls/data";
import { notImplementedMessage } from "./notImplemented";
import { useT } from "@common/i18n/useT";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const SlrFileViewerPanel = ({}: DocumentProps) => {
  const t = useT();
  return (
    <DataPanel>
      <PanelHeader title={t("panels.next.viewerTitle", { extension: ".SLR" })} />
      <EmptyState message={notImplementedMessage()} />
    </DataPanel>
  );
};

export const createSlrFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <SlrFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
