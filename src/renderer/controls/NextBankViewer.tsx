import styles from "./NextBankViewer.module.scss";
import { Column } from "./generic/Column";
import { MiniMemoryDump, openStaticMemoryDump } from "@renderer/appIde/DocumentPanels/Memory/StaticMemoryDump";
import { HeaderRow } from "./generic/Row";
import { SmallIconButton } from "./IconButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { Label, LabelSeparator } from "./Labels";

type Props = {
  documentSource?: string;
  contents: Uint8Array;
  bank?: number;
};

export const NextBankViewer = ({ documentSource, contents, bank }: Props) => {
  const { projectService } = useAppServices();
  return (
    <Column xclass={styles.headerRow}>
      <HeaderRow xclass={styles.headerRow}>
        <SmallIconButton
          iconName='pop-out'
          fill='--color-value'
          title='Display bank data dump'
          clicked={async () => {
            if (!documentSource) return;
            await openStaticMemoryDump(
              projectService.getActiveDocumentHubService(),
              `bankDump${documentSource}:${bank}`,
              `${documentSource} - Bank: ${bank}`,
              contents
            );
          }}
        />
        <LabelSeparator width={8} />
        <Label text={`Displaying 64 bytes out of $4000 (16384)`} />
      </HeaderRow>
      <MiniMemoryDump contents={contents} />
    </Column>
  );
};
