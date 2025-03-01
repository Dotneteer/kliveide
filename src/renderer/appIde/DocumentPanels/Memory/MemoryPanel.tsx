import { useEffect, useRef, useState } from "react";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { useSelector } from "@renderer/core/RendererProvider";
import { MF_BANK, MF_ROM } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { AddressInput } from "@renderer/controls/AddressInput";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { DumpSection } from "../DumpSection";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { useStateRefresh } from "@renderer/appIde/useStateRefresh";
import { LabelSeparator } from "@renderer/controls/Labels";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import { Value } from "@renderer/controls/generic/Value";
import { FullPanel, HStack } from "@renderer/controls/new/Panels";
import { PanelHeader } from "../helpers/PanelHeader";
import Dropdown, { DropdownOption } from "@renderer/controls/Dropdown";
import { Text } from "@renderer/controls/generic/Text";

type BankedMemoryPanelViewState = {
  topIndex?: number;
  isFullView?: boolean;
  currentSegment?: string;
  decimalView?: boolean;
  twoColumns?: boolean;
  charDump?: boolean;
  bankLabel?: boolean;
};

export type CachedRefreshState = {
  isFullView: boolean;
  currentSegment: string;
  decimalView: boolean;
};

const BankedMemoryPanel = ({ document }: DocumentProps) => {
  // --- Get the services used in this component
  const documentHubService = useDocumentHubService();
  const emuApi = useEmuApi();

  // --- Get the machine information
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const machineId = useSelector((s) => s.emulatorState.machineId);
  const [allowViews, setAllowViews] = useState<boolean>(false);
  const [segmentOptions, setSegmentOptions] = useState<DropdownOption[]>([]);

  // --- Read the view state of the document
  const viewState = useRef(
    (documentHubService.getDocumentViewState(document.id) as BankedMemoryPanelViewState) ?? {}
  );

  // --- View state variables
  const [topIndex, setTopIndex] = useState<number>(viewState.current?.topIndex ?? 0);
  const [isFullView, setIsFullView] = useState(viewState.current?.isFullView ?? true);
  const [currentSegment, setCurrentSegment] = useState<string>(null);
  const [bankLabel, setBankLabel] = useState(viewState.current?.bankLabel ?? true);

  // --- Display options
  const [decimalView, setDecimalView] = useState(viewState.current?.decimalView ?? false);
  const [twoColumns, setTwoColumns] = useState(viewState.current?.twoColumns ?? true);
  const [charDump, setCharDump] = useState(viewState.current?.charDump ?? true);

  // --- State of the memory view
  const refreshInProgress = useRef(false);
  const memory = useRef<Uint8Array>(new Uint8Array(0x1_0000));
  const [memoryItems, setMemoryItems] = useState<number[]>([]);
  const cachedItems = useRef<number[]>([]);
  const vlApi = useRef<VListHandle>(null);
  const [mem64kLabels, setMem64kLabels] = useState<string[]>([]);
  const [partitionLabels, setPartitionLabels] = useState<Record<number, string>>(null);
  const pointedRegs = useRef<Record<number, string>>({});
  const [scrollVersion, setScrollVersion] = useState(1);

  // --- We need to use a reference to autorefresh, as we pass this info to another trhead
  const cachedRefreshState = useRef<CachedRefreshState>({
    isFullView,
    decimalView,
    currentSegment
  });

  // --- Respond to machineId changes
  useEffect(() => {
    const machine = machineRegistry.find((mi) => mi.machineId === machineId);
    const romPagesValue = machine?.features?.[MF_ROM] ?? 0;
    const ramBankValue = machine?.features?.[MF_BANK] ?? 0;
    setAllowViews(romPagesValue > 0 || ramBankValue > 0);
    if (ramBankValue <= 8) {
      (async () => {
        const options: DropdownOption[] = [];
        const labels = await emuApi.getPartitionLabels();
        setPartitionLabels(labels);
        const ordered = Object.keys(labels)
          .map((l) => parseInt(l, 10))
          .sort((a, b) => (a < 0 && b < 0 ? b - a : a - b));
        ordered.forEach((key) => {
          if (key < 0) {
            options.push({ value: key.toString(), label: `ROM ${-key - 1}` });
          } else {
            options.push({ value: key.toString(), label: `BANK ${key}` });
          }
        });
        setSegmentOptions(options);
        setCurrentSegment("-1");
      })();
    }
  }, [machineId]);

  // --- Save the current view state
  const saveViewState = () => {
    const mergedState: BankedMemoryPanelViewState = {
      topIndex: topIndex,
      isFullView,
      currentSegment,
      decimalView,
      twoColumns,
      charDump,
      bankLabel
    };
    documentHubService.saveActiveDocumentState(mergedState);
  };

  // --- Creates the addresses to represent dump sections
  const createDumpSections = (length: number, hasTwoColums: boolean) => {
    const memItems: number[] = [];
    for (let addr = 0; addr < length; addr += hasTwoColums ? 0x10 : 0x08) {
      memItems.push(addr);
    }
    cachedItems.current = memItems;
    setMemoryItems(memItems);
  };

  // --- This function refreshes the memory
  const refreshMemoryView = async () => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    try {
      // --- Obtain the memory contents
      let partition: number | undefined;

      // --- Use partitions when multiple ROMs or Banks available
      if (!cachedRefreshState.current.isFullView) {
        partition = parseInt(cachedRefreshState.current.currentSegment);
        if (isNaN(partition)) {
          partition = -1;
        }
      }

      // --- Get memory information
      const response = await emuApi.getMemoryContents(partition);
      memory.current = response.memory;
      setMem64kLabels(response.partitionLabels);

      // --- Calculate tooltips for pointed addresses
      pointedRegs.current = {};
      if (
        machineState === MachineControllerState.Paused ||
        machineState === MachineControllerState.Stopped
      ) {
        extendPointedAddress("BC", response.bc);
        extendPointedAddress("DE", response.de);
        extendPointedAddress("HL", response.hl);
        extendPointedAddress("BC'", response.bc_);
        extendPointedAddress("DE'", response.de_);
        extendPointedAddress("HL'", response.hl_);
        extendPointedAddress("PC", response.pc);
        extendPointedAddress("SP", response.sp);
        extendPointedAddress("IX", response.ix);
        extendPointedAddress("IY", response.iy);
        extendPointedAddress("IR", response.ir);
        extendPointedAddress("WZ", response.sp);
      }
      createDumpSections(memory.current.length, twoColumns);
    } finally {
      refreshInProgress.current = false;
      setScrollVersion(scrollVersion + 1);
    }

    function extendPointedAddress(regName: string, regValue: number): void {
      if (pointedRegs.current[regValue]) {
        pointedRegs.current[regValue] += ", " + regName;
      } else {
        pointedRegs.current[regValue] = regName;
      }
    }
  };

  // --- Save viewState changed
  useEffect(() => {
    saveViewState();
    cachedRefreshState.current = {
      isFullView,
      decimalView,
      currentSegment
    };
  }, [topIndex, isFullView, decimalView, currentSegment, twoColumns, charDump, bankLabel]);

  // --- Initial view: refresh the disassembly lint and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshMemoryView();
    setScrollVersion(scrollVersion + 1);
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (!memoryItems.length) return;
    vlApi.current?.scrollToIndex(Math.floor(topIndex), {
      align: "start"
    });
  }, [scrollVersion]);

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async () => {
      switch (machineState) {
        case MachineControllerState.Paused:
        case MachineControllerState.Stopped:
          refreshMemoryView();
      }
    })();
  }, [machineState]);

  useEffect(() => {
    refreshMemoryView();
  }, [currentSegment, isFullView]);

  // --- Change the length of the current dump section according to the view mode
  useEffect(
    () => createDumpSections(isFullView ? 0x1_0000 : 0x4000, twoColumns),
    [isFullView, twoColumns]
  );

  // --- Take care of refreshing the screen
  useStateRefresh(500, refreshMemoryView);

  const OptionsBar = () => {
    return (
      <>
        <LabeledSwitch
          value={decimalView}
          label="Decimal"
          title="Use decimal numbers?"
          clicked={(v) => setDecimalView(v)}
        />
        <LabeledSwitch
          value={twoColumns}
          label="2 Columns"
          title="Use two-column layout?"
          clicked={(v) => {
            setTwoColumns(v);
            createDumpSections(memory.current.length, v);
            if (v) {
              setTopIndex(Math.floor(topIndex / 2));
            } else {
              setTopIndex(topIndex * 2);
            }
            setScrollVersion(scrollVersion + 1);
          }}
        />
        <LabeledSwitch
          value={charDump}
          label="Chars"
          title="Show characters dump?"
          clicked={setCharDump}
        />
        <AddressInput
          label="Go To"
          clearOnEnter={true}
          decimalView={decimalView}
          onAddressSent={async (address) => {
            setTopIndex(Math.floor(address / (twoColumns ? 16 : 8)));
            setScrollVersion(scrollVersion + 1);
          }}
        />
      </>
    );
  };

  return (
    <FullPanel fontFamily="--monospace-font" fontSize="0.8em">
      <PanelHeader>
        <OptionsBar />
      </PanelHeader>
      {allowViews && (
        <PanelHeader>
          <LabeledSwitch
            value={isFullView}
            label="64K View"
            title="Show the full 64K memory"
            clicked={(v) => setIsFullView(v)}
          />
          {!isFullView && (
            <>
              <LabelSeparator width={4} />
              <Text text="Bank" />
              <LabelSeparator width={4} />
              <Dropdown
                options={segmentOptions}
                initialValue={currentSegment?.toString()}
                width="100px"
                onChanged={(opt) => {
                  setCurrentSegment(opt);
                }}
              />
              <LabeledSwitch
                value={bankLabel}
                label="Show bank label"
                title="Display bank label information?"
                clicked={setBankLabel}
              />
            </>
          )}
        </PanelHeader>
      )}
      <FullPanel>
        <VirtualizedList
          items={memoryItems}
          overscan={25}
          onScroll={() => {
            if (!vlApi.current || cachedItems.current.length === 0) return;
            setTopIndex(vlApi.current.findStartIndex());
          }}
          apiLoaded={(api) => (vlApi.current = api)}
          renderItem={(idx) => {
            const partitionLabel = isFullView
              ? mem64kLabels[memoryItems[idx] >> 13]
              : partitionLabels?.[parseInt(currentSegment)];
            return (
              <HStack
                backgroundColor={idx % 2 === 0 ? "--bgcolor-disass-even-row" : "transparent"}
                hoverBackgroundColor="--bgcolor-disass-hover"
              >
                <DumpSection
                  showPartitions={bankLabel}
                  partitionLabel={partitionLabel}
                  address={memoryItems[idx]}
                  memory={memory.current}
                  charDump={charDump}
                  pointedInfo={pointedRegs.current}
                  decimalView={decimalView}
                />
                {twoColumns && (
                  <DumpSection
                    showPartitions={bankLabel}
                    partitionLabel={partitionLabel}
                    address={memoryItems[idx] + 0x08}
                    memory={memory.current}
                    pointedInfo={pointedRegs.current}
                    charDump={charDump}
                    decimalView={decimalView}
                  />
                )}
              </HStack>
            );
          }}
        />
      </FullPanel>
    </FullPanel>
  );
};

export const createMemoryPanel = ({ document, contents }: DocumentProps) => (
  <BankedMemoryPanel document={document} contents={contents} apiLoaded={() => {}} />
);
