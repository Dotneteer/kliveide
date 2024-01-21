import { Row } from "@renderer/controls/GeneralControls";
import styles from "./StaticMemoryDump.module.scss";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { Label } from "@renderer/controls/Labels";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { STATIC_MEMORY_DUMP_VIEWER } from "@common/state/common-ids";

type MemoryViewState = {
  topAddress?: number;
  twoColumns?: boolean;
  charDump?: boolean;
};

const StaticMemoryDump = ({
  document,
  contents
}: DocumentProps<MemoryViewState>) => {
  return (
    <Row>
      <Label text='Static Memory Dump' />
    </Row>
  );
};

export const createStaticMemoryDump = ({
  document,
  contents
}: DocumentProps) => (
  <StaticMemoryDump document={document} contents={contents} />
);

let memoryDumpIndex = 1;

export async function openStaticMemoryDump (
  documentHubService: IDocumentHubService,
  dumpId: string,
  title: string,
  contents: Uint8Array
): Promise<void> {
  const id = `memoryDump-${dumpId}`;
  if (documentHubService.isOpen(id)) {
    documentHubService.setActiveDocument(id);
  } else {
    await documentHubService.openDocument(
      {
        id,
        name: title,
        type: STATIC_MEMORY_DUMP_VIEWER,
        iconName: "memory-icon",
        iconFill: "--console-ansi-bright-magenta"
      },
      contents,
      false
    );
  }
}
