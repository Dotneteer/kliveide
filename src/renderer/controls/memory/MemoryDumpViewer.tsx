import styles from "./MemoryDumpViewer.module.scss";
import { Column } from "../generic/Column";
import {
  MiniMemoryDump,
  openStaticMemoryDump
} from "@renderer/appIde/DocumentPanels/Memory/StaticMemoryDump";
import { HeaderRow } from "../generic/Row";
import { SmallIconButton } from "../IconButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { Label, LabelSeparator } from "../Labels";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";

type Props = {
  documentSource: string;
  contents: Uint8Array;
  bank?: number;
  iconTitle: string;
  idFactory: (documentSource: string, bank: number) => string;
  titleFactory: (documentSource: string, bank: number) => string;
};

export const MemoryDumpViewer = ({
  documentSource,
  contents,
  bank,
  iconTitle,
  idFactory,
  titleFactory
}: Props) => {
  const { projectService } = useAppServices();
  return (
    <Column xclass={styles.headerRow}>
      <HeaderRow xclass={styles.headerRow}>
        <SmallIconButton
          iconName='pop-out'
          fill='--color-value'
          title={iconTitle}
          clicked={async () => {
            if (!documentSource) return;
            await openStaticMemoryDump(
              projectService.getActiveDocumentHubService(),
              idFactory(documentSource, bank), // `bankDump${documentSource}:${bank}`,
              titleFactory(documentSource, bank), // `${documentSource} - Bank: ${bank}`,
              contents
            );
          }}
        />
        <LabelSeparator width={8} />
        <Label
          text={`Displaying 64 bytes out of ${contents.length} ($${toHexa4(
            contents.length
          )})`}
        />
      </HeaderRow>
      <MiniMemoryDump contents={contents} />
    </Column>
  );
};
