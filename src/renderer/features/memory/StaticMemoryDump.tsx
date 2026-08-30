import styles from "./StaticMemoryDump.module.scss";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { STATIC_MEMORY_DUMP_VIEWER } from "@common/state/common-ids";
import { Row } from "@renderer/controls/layout/Row";
import { AddressInput } from "@renderer/controls/AddressInput";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import { createRowAddresses } from "./memoryViewModel";
import { MemoryDumpSection } from "./MemoryDumpSection";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { PanelHeader } from "@renderer/appIde/DocumentPanels/helpers/PanelHeader";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { Text } from "@renderer/controls/layout/Text";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { MemorySection, type DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import { DisassemblyRow } from "@renderer/appIde/DocumentPanels/DisassemblyRow";

type MemoryDumpViewState = {
  disassemblyEnabled?: boolean;
  viewMode?: StaticDumpViewMode;
  decimalView?: boolean;
  disassOffset?: number;
  twoColumns?: boolean;
  charDump?: boolean;
  scrollPosition?: number;
  disassemblyScrollPosition?: number;
  version?: number;
  topAddress?: number;
};

type StaticDumpViewMode = "memory" | "disassembly";

type StaticMemoryDumpOptions = {
  disassemblyEnabled?: boolean;
  disassOffset?: number;
};

const STATIC_DUMP_ROW_ITEM_SIZE = 22;
const STATIC_DISASSEMBLY_ROW_ITEM_SIZE = 18;

const staticDumpViewModeOptions: DropdownOption[] = [
  { value: "memory", label: "Memory" },
  { value: "disassembly", label: "Disassembly" }
];

function createStaticDisassemblyOffsetOptions(decimalView: boolean): DropdownOption[] {
  return [0x0000, 0x4000, 0x8000, 0xc000].map((offset) => ({
    value: offset.toString(10),
    label: decimalView ? offset.toString(10) : `$${toHexa4(offset)}`
  }));
}

const StaticMemoryDump = ({
  document,
  contents,
  viewState
}: DocumentProps<MemoryDumpViewState>) => {
  const documentHubService = useDocumentHubService();
  const [currentViewState, setCurrentViewState] = useState<MemoryDumpViewState>(
    viewState ?? {}
  );
  const disassemblyEnabled = currentViewState.disassemblyEnabled ?? false;
  const viewMode: StaticDumpViewMode = disassemblyEnabled
    ? (currentViewState.viewMode ?? "memory")
    : "memory";
  const decimalView = currentViewState.decimalView ?? false;
  const disassOffset = currentViewState.disassOffset ?? 0;
  const [memoryJumpAddress, setMemoryJumpAddress] = useState<number>();
  const [disassemblyJumpAddress, setDisassemblyJumpAddress] = useState<number>();
  const [disassemblyItems, setDisassemblyItems] = useState<DisassemblyItem[]>([]);
  const memoryVlApi = useRef<VListHandle>();
  const disassemblyVlApi = useRef<VListHandle>();
  const pendingScrollPosition = useRef(viewState?.scrollPosition ?? 0);
  const pendingDisassemblyScrollPosition = useRef(viewState?.disassemblyScrollPosition ?? 0);
  const restoredInitialScroll = useRef(false);
  const restoredInitialDisassemblyScroll = useRef(false);
  const items = useMemo(() => createRowAddresses(contents.length, 16), [contents.length]);

  const changeViewState = useCallback((setter: (vs: MemoryDumpViewState) => void) => {
    setCurrentViewState((current) => {
      const newViewState = { ...current };
      setter(newViewState);
      return newViewState;
    });
  }, []);

  useEffect(() => {
    if (document?.id) {
      documentHubService.setDocumentViewState(document.id, currentViewState);
    }
  }, [currentViewState, document?.id, documentHubService]);

  useEffect(() => {
    if (!memoryVlApi.current || memoryJumpAddress === undefined) return;
    memoryVlApi.current.scrollToIndex(Math.floor(memoryJumpAddress / 16), {
      align: "start"
    });
  }, [memoryJumpAddress]);

  useEffect(() => {
    if (!disassemblyEnabled || viewMode !== "disassembly") return;
    let cancelled = false;

    (async () => {
      const memorySections = [
        new MemorySection(0x0000, Math.max(0, contents.length - 1))
      ];
      const disassembler = new Z80Disassembler(memorySections, contents, undefined, {
        allowExtendedSet: true,
        decimalMode: decimalView
      });
      disassembler.setAddressOffset(disassOffset);
      const output = await disassembler.disassemble(0x0000, contents.length - 1);
      if (!cancelled) {
        setDisassemblyItems(output?.outputItems ?? []);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contents, decimalView, disassOffset, disassemblyEnabled, viewMode]);

  useEffect(() => {
    if (!disassemblyVlApi.current || disassemblyJumpAddress === undefined) return;

    const idx = disassemblyItems.findIndex((item) => item.address >= disassemblyJumpAddress);
    if (idx >= 0) {
      disassemblyVlApi.current.scrollToIndex(idx, {
        align: "start"
      });
    }
  }, [disassemblyItems, disassemblyJumpAddress]);

  return (
    <FullPanel fontFamily="--monospace-font" fontSize="0.8em">
      <PanelHeader>
        {disassemblyEnabled && (
          <>
            <Text text="View" />
            <LabelSeparator />
            <Dropdown
              options={staticDumpViewModeOptions}
              initialValue={viewMode}
              width={104}
              onChanged={(value) =>
                changeViewState((vs) => (vs.viewMode = value as StaticDumpViewMode))
              }
            />
            <LabelSeparator width={8} />
          </>
        )}
        {viewMode === "disassembly" && (
          <>
            <LabeledSwitch
              value={decimalView}
              label="Decimal"
              title="Use decimal numbers?"
              clicked={(value) => changeViewState((vs) => (vs.decimalView = value))}
            />
            <LabelSeparator width={8} />
            <Text text="Offset" />
            <LabelSeparator />
            <Dropdown
              options={createStaticDisassemblyOffsetOptions(decimalView)}
              initialValue={disassOffset.toString(10)}
              width={68}
              onChanged={(value) =>
                changeViewState((vs) => (vs.disassOffset = parseInt(value, 10)))
              }
            />
            <LabelSeparator width={8} />
          </>
        )}
        {viewMode === "memory" && (
          <AddressInput
            label="Go to address:"
            decimalView={false}
            onAddressSent={async (address) => {
              changeViewState((vs) => (vs.topAddress = address));
              setMemoryJumpAddress(address);
            }}
          />
        )}
        {viewMode === "disassembly" && (
          <AddressInput
            label="Go To"
            clearOnEnter={true}
            decimalView={decimalView}
            onAddressSent={async (address) => {
              changeViewState((vs) => (vs.topAddress = address));
              setDisassemblyJumpAddress(address & 0xffff);
            }}
          />
        )}
      </PanelHeader>
      <FullPanel>
        {contents && viewMode === "memory" ? (
          <VirtualizedList
            items={items}
            itemSize={STATIC_DUMP_ROW_ITEM_SIZE}
            revealUnmeasuredItems
            onScroll={(offset) => {
              pendingScrollPosition.current = offset;
            }}
            onScrollEnd={() => {
              const topPos = pendingScrollPosition.current;
              changeViewState((vs) => (vs.scrollPosition = topPos));
            }}
            apiLoaded={(api) => {
              memoryVlApi.current = api;
              if (!restoredInitialScroll.current && viewState?.scrollPosition) {
                restoredInitialScroll.current = true;
                requestAnimationFrame(() => {
                  api.scrollTo(viewState.scrollPosition);
                });
              }
            }}
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
                      bytes={contents.subarray(item, item + 8)}
                      decimalView={false}
                      charDump={true}
                      lastJumpAddress={-1}
                    />
                    <MemoryDumpSection
                      address={item + 8}
                      bytes={contents.subarray(item + 8, item + 16)}
                      decimalView={false}
                      charDump={true}
                      lastJumpAddress={-1}
                    />
                  </Row>
                </div>
              );
            }}
          />
        ) : null}
        {contents && viewMode === "disassembly" ? (
          <VirtualizedList
            items={disassemblyItems}
            itemSize={STATIC_DISASSEMBLY_ROW_ITEM_SIZE}
            overscan={25}
            revealUnmeasuredItems
            onScroll={(offset) => {
              pendingDisassemblyScrollPosition.current = offset;
            }}
            onScrollEnd={() => {
              const topPos = pendingDisassemblyScrollPosition.current;
              changeViewState((vs) => (vs.disassemblyScrollPosition = topPos));
            }}
            apiLoaded={(api) => {
              disassemblyVlApi.current = api;
              if (
                !restoredInitialDisassemblyScroll.current &&
                viewState?.disassemblyScrollPosition
              ) {
                restoredInitialDisassemblyScroll.current = true;
                requestAnimationFrame(() => {
                  api.scrollTo(viewState.disassemblyScrollPosition);
                });
              }
            }}
            renderItem={(idx) => {
              const item = disassemblyItems[idx];
              if (!item) return <div></div>;

              return (
                <DisassemblyRow
                  bankLabel={false}
                  currentSegment={0}
                  decimalView={decimalView}
                  index={idx}
                  isFullView={true}
                  item={item}
                  mem64kLabels={[]}
                  partitionLabels={{}}
                  pausedPc={-1}
                  rowHeight={STATIC_DISASSEMBLY_ROW_ITEM_SIZE}
                  showBanks={false}
                />
              );
            }}
          />
        ) : null}
      </FullPanel>
    </FullPanel>
  );
};

export const createStaticMemoryDump = ({ document, contents, viewState }: DocumentProps) => (
  <StaticMemoryDump document={document} contents={contents} viewState={viewState} />
);

export async function openStaticMemoryDump(
  documentHubService: IDocumentHubService,
  dumpId: string,
  title: string,
  contents: Uint8Array,
  options: StaticMemoryDumpOptions = {}
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
      {
        disassemblyEnabled: options.disassemblyEnabled ?? false,
        disassOffset: options.disassOffset ?? 0
      } satisfies MemoryDumpViewState,
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
