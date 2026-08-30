import styles from "./MemoryDumpViewer.module.scss";
import { Column } from "@renderer/controls/layout/Column";
import {
  MiniMemoryDump,
  openStaticMemoryDump
} from "@renderer/features/memory/StaticMemoryDump";
import { HeaderRow } from "@renderer/controls/layout/Row";
import { SmallIconButton } from "../IconButton";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { Label } from "@renderer/controls/layout/Label";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";

type Props = {
  documentSource: string;
  contents: Uint8Array;
  bank?: number;
  allowDisassembly?: boolean;
  disassOffset?: number;
  nexAnnotationPath?: string;
  nexAnnotationBank?: number;
  iconTitle: string;
  idFactory: (documentSource: string, bank: number) => string;
  titleFactory: (documentSource: string, bank: number) => string;
};

export const MemoryDumpViewer = ({
  documentSource,
  contents,
  bank,
  allowDisassembly = false,
  disassOffset,
  nexAnnotationPath,
  nexAnnotationBank,
  iconTitle,
  idFactory,
  titleFactory
}: Props) => {
  const documentHubService = useDocumentHubService();
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
              documentHubService,
              idFactory(documentSource, bank), // `bankDump${documentSource}:${bank}`,
              titleFactory(documentSource, bank), // `${documentSource} - Bank: ${bank}`,
              contents,
              {
                disassemblyEnabled: allowDisassembly,
                disassOffset,
                nexAnnotationPath,
                nexAnnotationBank
              }
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
