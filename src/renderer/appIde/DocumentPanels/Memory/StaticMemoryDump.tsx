import styles from "./StaticMemoryDump.module.scss";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { STATIC_MEMORY_DUMP_VIEWER } from "@common/state/common-ids";
import { GenericViewerPanel } from "../helpers/GenericViewerPanel";
import { Row } from "@renderer/controls/generic/Row";
import { AddressInput } from "@renderer/controls/AddressInput";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { LabeledText } from "@renderer/controls/generic/LabeledText";
import { createElement, useEffect, useRef, useState } from "react";
import { VirtualizedListView } from "@renderer/controls/VirtualizedListView";
import { VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import classnames from "@renderer/utils/classnames";
import { LabelSeparator } from "@renderer/controls/Labels";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { DumpSection } from "./DumpSection";

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
    headerRenderer: context => {
      return (
        <Row>
          <AddressInput
            label='Go to address:'
            onAddressSent={async address => {
              context.changeViewState(vs => (vs.topAddress = address));
              context.update(address);
            }}
          />
          <LabelSeparator width={8} />
          <LabeledText
            label='#of bytes:'
            value={`$${toHexa4(contents.length)} (${contents.length})`}
          />
        </Row>
      );
    },
    renderer: context => {
      const [items, setItems] = useState<number[]>([]);
      const vlApi = useRef<VirtualizedListApi>();

      // --- Process the contents when it changes
      useEffect(() => {
        const newItems: number[] = [];
        for (let i = 0; i < contents.length; i += 16) {
          newItems.push(i);
        }
        setItems(newItems);
      }, [contents]);

      useInitializeAsync(async () => {
        if (viewState?.scrollPosition) {
          await new Promise(resolve => setTimeout(resolve, 40));
          vlApi.current?.scrollToOffset(
            viewState.scrollPosition
          );
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
        <VirtualizedListView
          items={items}
          approxSize={22}
          fixItemHeight={true}
          scrolled={() => {
            if (!vlApi.current) return;
            const topPos = vlApi.current.getScrollTop();
            context.changeViewState(vs => (vs.scrollPosition = topPos));
          }}
          vlApiLoaded={api => (vlApi.current = api)}
          itemRenderer={idx => {
            return (
              <div
                className={classnames(styles.item, {
                  [styles.even]: idx % 2 == 0
                })}
              >
                <Row>
                  <DumpSection memory={contents} address={16 * idx} />
                  <DumpSection memory={contents} address={16 * idx + 8} />
                </Row>
              </div>
            );
          }}
        />
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

type MiniDumpProps = {
  contents: Uint8Array;
  length?: number;
};

export const MiniMemoryDump = ({ contents, length = 64 }: MiniDumpProps) => {
  const [items, setItems] = useState<number[]>([]);

  // --- Process the contents when it changes
  useEffect(() => {
    const newItems: number[] = [];
    for (let i = 0; i < length; i += 16) {
      newItems.push(i);
    }
    setItems(newItems);
  }, [contents]);

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
              <DumpSection memory={contents} address={item} />
              <DumpSection memory={contents} address={item + 8} />
            </Row>
          </div>
        );
      })}
    </>
  ) : null;
};
