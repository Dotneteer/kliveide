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
  decimalView?: boolean;
  /** The view the popped-out dump opens in. Sprites exists only for NEX banks. */
  viewMode?: "memory" | "disassembly" | "sprites";
  nexAnnotationPath?: string;
  nexAnnotationBank?: number;
  iconTitle: string;
  idFactory: (documentSource: string, bank: number) => string;
  titleFactory: (documentSource: string, bank: number) => string;
  /**
   * Runs the open, for a host that wants it to be more than an open — the NEX viewer records it in
   * the navigation history. Omitted, the dump simply opens.
   */
  openThrough?: (open: () => Promise<void>) => Promise<void>;
};

export const MemoryDumpViewer = ({
  documentSource,
  contents,
  bank,
  allowDisassembly = false,
  disassOffset,
  decimalView,
  viewMode,
  nexAnnotationPath,
  nexAnnotationBank,
  iconTitle,
  idFactory,
  titleFactory,
  openThrough = (open) => open()
}: Props) => {
  const documentHubService = useDocumentHubService();
  return (
    <Column xclass={styles.headerRow}>
      <HeaderRow xclass={styles.headerRow}>
        <SmallIconButton
          iconName='square-arrow-out-up-right'
          fill='--color-value'
          title={iconTitle}
          clicked={async () => {
            if (!documentSource) return;
            await openThrough(() =>
              openStaticMemoryDump(
                documentHubService,
                idFactory(documentSource, bank),
                titleFactory(documentSource, bank),
                contents,
                {
                  disassemblyEnabled: allowDisassembly,
                  disassOffset,
                  decimalView,
                  viewMode,
                  nexAnnotationPath,
                  nexAnnotationBank
                }
              )
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
