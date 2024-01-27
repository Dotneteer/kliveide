import styles from "./StaticMemoryDump.module.scss";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { STATIC_MEMORY_DUMP_VIEWER } from "@common/state/common-ids";
import { GenericViewerPanel } from "../helpers/GenericViewerPanel";
import { Row } from "@renderer/controls/generic/Row";
import { AddressInput } from "@renderer/controls/AddressInput";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { LabeledText } from "@renderer/controls/generic/LabeledText";
import { useEffect, useRef, useState } from "react";
import { VirtualizedListView } from "@renderer/controls/VirtualizedListView";
import { VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import classnames from "@renderer/utils/classnames";
import { Label } from "@renderer/controls/generic/Label";
import { Panel } from "@renderer/controls/generic/Panel";
import { LabelSeparator } from "@renderer/controls/Labels";

type MemoryDumpViewState = {
  twoColumns?: boolean;
  charDump?: boolean;
  scrollPosition?: number;
};

const StaticMemoryDump = ({
  document,
  contents,
  viewState
}: DocumentProps<MemoryDumpViewState>) => {
  return GenericViewerPanel<MemoryDumpViewState>({
    document,
    contents,
    viewState,
    renderer: context => {
      const [items, setItems] = useState<number[]>([]);
      const vlApi = useRef<VirtualizedListApi>();

      // --- Process the contents when it changes
      useEffect(() => {
        const newItems: number[] = [];
        for (let i = 0; i < contents.length; i += 8) {
          newItems.push(i);
        }
        setItems(newItems);
      }, [contents]);

      return contents ? (
        <>
          <Row>
            <AddressInput
              label='Go to address:'
              onAddressSent={async address => {
                // setTopAddress(Math.floor(address / 8));
                // setScrollVersion(scrollVersion + 1);
              }}
            />
            <LabelSeparator width={8} />
            <LabeledText
              label='#of bytes:'
              value={`$${toHexa4(contents.length)} (${contents.length})`}
            />
          </Row>
          <Panel>
            <VirtualizedListView
              items={items}
              approxSize={20}
              fixItemHeight={true}
              scrolled={() => {
                // if (!vlApi.current || cachedItems.current.length === 0) return;
                // const range = vlApi.current.getRange();
                // setTopAddress(range.startIndex);
              }}
              vlApiLoaded={api => (vlApi.current = api)}
              itemRenderer={idx => {
                return (
                  <div
                    className={classnames(styles.item, {
                      [styles.even]: idx % 2 == 0,
                      [styles.twoSections]: true // TODO
                    })}
                  >
                    <Label text={toHexa4(idx * 8)} />
                  </div>
                );
              }}
            />
          </Panel>
        </>
      ) : null;
    }
  });
};

export const createStaticMemoryDump = ({
  document,
  contents,
  viewState
}: DocumentProps) => (
  <StaticMemoryDump
    document={document}
    contents={contents}
    viewState={viewState}
  />
);

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
        iconFill: "--console-ansi-bright-magenta",
        contents
      },
      undefined,
      false
    );
  }
}
