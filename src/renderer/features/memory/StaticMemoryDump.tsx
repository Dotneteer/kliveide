import styles from "./StaticMemoryDump.module.scss";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { STATIC_MEMORY_DUMP_VIEWER } from "@common/state/common-ids";
import { GenericViewerPanel } from "@renderer/appIde/DocumentPanels/helpers/GenericViewerPanel";
import { Row } from "@renderer/controls/layout/Row";
import { AddressInput } from "@renderer/controls/AddressInput";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { LabeledText } from "@renderer/controls/layout/LabeledText";
import { createElement, useEffect, useMemo, useRef } from "react";
import classnames from "classnames";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import { createRowAddresses } from "./memoryViewModel";
import { MemoryDumpSection } from "./MemoryDumpSection";

type MemoryDumpViewState = {
  twoColumns?: boolean;
  charDump?: boolean;
  scrollPosition?: number;
  version?: number;
  topAddress?: number;
};

const StaticMemoryDump = ({
  document,
  contents,
  viewState
}: DocumentProps<MemoryDumpViewState>) => {
  return createElement(GenericViewerPanel<MemoryDumpViewState>, {
    saveScrollTop: false,
    document,
    contents,
    viewState,
    headerRenderer: (context) => {
      return (
        <Row>
          <AddressInput
            label="Go to address:"
            decimalView={false}
            onAddressSent={async (address) => {
              context.changeViewState((vs) => (vs.topAddress = address));
              context.update(address);
            }}
          />
          <LabelSeparator width={8} />
          <LabeledText
            label="#of bytes:"
            value={`$${toHexa4(contents.length)} (${contents.length})`}
          />
        </Row>
      );
    },
    renderer: (context) => {
      const vlApi = useRef<VListHandle>();
      const items = useMemo(() => createRowAddresses(contents.length, 16), [contents.length]);

      useInitializeAsync(async () => {
        if (viewState?.scrollPosition) {
          await new Promise((resolve) => setTimeout(resolve, 40));
          vlApi.current?.scrollTo(viewState.scrollPosition);
        }
      });

      // --- Update the scroll position according to the address set
      useEffect(() => {
        if (!vlApi.current || typeof context.contextData !== "number") return;
        vlApi.current.scrollToIndex(Math.floor(context.contextData / 16), {
          align: "start"
        });
      }, [context.version]);

      return contents ? (
        <VirtualizedList
          items={items}
          onScroll={() => {
            if (!vlApi.current) return;
            const topPos = vlApi.current.getItemOffset(0);
            context.changeViewState((vs) => (vs.scrollPosition = topPos));
          }}
          apiLoaded={(api) => (vlApi.current = api)}
          renderItem={(idx, item) => {
            return (
              <div
                className={classnames(styles.item, {
                  [styles.even]: idx % 2 == 0
                })}
              >
                <Row>
                  <MemoryDumpSection
                    address={item}
                    bytes={Array.from(contents.slice(item, item + 8))}
                    decimalView={false}
                    charDump={true}
                    lastJumpAddress={-1}
                  />
                  <MemoryDumpSection
                    address={item + 8}
                    bytes={Array.from(contents.slice(item + 8, item + 16))}
                    decimalView={false}
                    charDump={true}
                    lastJumpAddress={-1}
                  />
                </Row>
              </div>
            );
          }}
        />
      ) : null;
    }
  });
};

export const createStaticMemoryDump = ({ document, contents, viewState }: DocumentProps) => (
  <StaticMemoryDump document={document} contents={contents} viewState={viewState} />
);

export async function openStaticMemoryDump(
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

type MiniDumpProps = {
  contents: Uint8Array;
  length?: number;
};

export const MiniMemoryDump = ({ contents, length = 64 }: MiniDumpProps) => {
  const displayLength = Math.min(length, contents.length);
  const items = useMemo(
    () => createRowAddresses(displayLength, 16),
    [displayLength]
  );

  return items?.length ? (
    <>
      <div style={{ height: 4 }} />
      {items.map((item, idx) => {
        return (
          <div
            key={idx}
            className={classnames(styles.item, {
              [styles.even]: idx % 2 == 0
            })}
          >
            <Row>
              <MemoryDumpSection
                address={item}
                bytes={Array.from(contents.slice(item, item + 8))}
                decimalView={false}
                charDump={true}
                lastJumpAddress={-1}
              />
              {item + 8 < displayLength && (
                <MemoryDumpSection
                  address={item + 8}
                  bytes={Array.from(contents.slice(item + 8, item + 16))}
                  decimalView={false}
                  charDump={true}
                  lastJumpAddress={-1}
                />
              )}
            </Row>
          </div>
        );
      })}
    </>
  ) : null;
};
