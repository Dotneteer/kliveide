import styles from "./BankedDisassemblyPanel.module.scss";
import { useEffect, useRef, useState } from "react";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import {
  CT_DISASSEMBLER,
  CT_DISASSEMBLER_VIEW,
  MF_BANK,
  MF_ROM
} from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { AddressInput } from "@renderer/controls/AddressInput";
import {
  Label,
  LabelSeparator,
  Secondary,
  Value
} from "@renderer/controls/Labels";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { LabeledText } from "@renderer/controls/generic/LabeledText";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { setIdeStatusMessageAction } from "@common/state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";
import {
  DisassemblyItem,
  MemorySection,
  MemorySectionType
} from "../z80-disassembler/disassembly-helper";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { Z80Disassembler } from "../z80-disassembler/z80-disassembler";
import { ICustomDisassembler } from "../z80-disassembler/custom-disassembly";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { LabeledGroup } from "@renderer/controls/LabeledGroup";
import { Dropdown } from "@renderer/controls/Dropdown";
import { VirtualizedListView } from "@renderer/controls/VirtualizedListView";
import classnames from "@renderer/utils/classnames";
import { BreakpointIndicator } from "./BreakpointIndicator";
import { getBreakpointKey } from "@common/utils/breakpoints";
import { toHexa2, toHexa4 } from "../services/ide-commands";
import { useStateRefresh } from "../useStateRefresh";

type MemoryViewMode = "full" | "rom" | "ram" | "bank";

type BankedMemoryPanelViewState = {
  topAddress?: number;
  autoRefresh?: boolean;
  viewMode?: MemoryViewMode;
  prevViewMode?: MemoryViewMode;
  romPage?: number;
  ramBank?: number;
  bankLabel?: boolean;
  ram?: boolean;
  screen?: boolean;
  disassRange?: string;
};

export type CachedRefreshState = {
  autoRefresh: boolean;
  viewMode: MemoryViewMode;
  romPage: number;
  ramBank: number;
};

const Bank16KOptions = [
  { value: "0", label: "0000-3FFF" },
  { value: "1", label: "4000-7FFF" },
  { value: "2", label: "8000-BFFF" },
  { value: "3", label: "C000-FFFF" }
];

const BankedDisassemblyPanel = ({ document, contents }: DocumentProps) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const { messenger } = useRendererContext();

  // --- Get the machine information
  const machineState = useSelector(s => s.emulatorState?.machineState);
  const machineId = useSelector(s => s.emulatorState.machineId);
  const machineInfo = machineRegistry.find(mi => mi.machineId === machineId);
  const romPages = machineInfo?.features?.[MF_ROM] ?? 0;
  const showRoms = romPages > 0;
  const ramBanks = machineInfo?.features?.[MF_BANK] ?? 0;
  const showBanks = ramBanks > 0;
  const allowBankInput = ramBanks > 8;
  const allowViews = showBanks || showRoms;
  const showRamOption =
    machineInfo.toolInfo?.[CT_DISASSEMBLER_VIEW]?.showRamOption ?? true;
  const showScreenOption =
    machineInfo.toolInfo?.[CT_DISASSEMBLER_VIEW]?.showScreenOption ?? true;

  const headerRef = useRef<HTMLDivElement>(null);

  // --- Create a list of number range
  const range = (start: number, end: number) => {
    return [...Array(end - start + 1).keys()].map(i => i + start);
  };

  // --- Read the view state of the document
  const viewState = useRef(
    (documentHubService.getDocumentViewState(
      document.id
    ) as BankedMemoryPanelViewState) ?? {}
  );

  // --- View state
  const [topAddress, setTopAddress] = useState<number>(
    viewState.current?.topAddress ?? 0
  );
  const [autoRefresh, setAutoRefresh] = useState(
    viewState.current?.autoRefresh ?? true
  );
  const [viewMode, setViewMode] = useState<MemoryViewMode>(
    viewState.current?.viewMode ?? "full"
  );
  const [prevViewMode, setPrevViewMode] = useState<MemoryViewMode>(
    viewState.current?.prevViewMode ?? "ram"
  );
  const [romPage, setRomPage] = useState<number>(
    viewState.current?.romPage ?? 0
  );
  const [ramBank, setRamBank] = useState<number>(
    viewState.current?.ramBank ?? 0
  );
  const [bankLabel, setBankLabel] = useState(
    viewState.current?.bankLabel ?? true
  );
  const [ram, setRam] = useState(viewState.current?.ram ?? true);
  const [screen, setScreen] = useState(viewState.current?.screen ?? true);
  const [disassRange, setDisassRange] = useState(
    (viewState.current?.disassRange ?? 0).toString()
  );

  // --- ULA-related state
  const [currentRomPage, setCurrentRomPage] = useState<number>(0);
  const [currentRamBank, setCurrentRamBank] = useState<number>(0);

  const customDisassembly = machineInfo.toolInfo?.[CT_DISASSEMBLER];

  const [pausedPc, setPausedPc] = useState(0);

  // --- Internal state values for disassembly
  const cachedItems = useRef<DisassemblyItem[]>([]);
  const breakpoints = useRef<BreakpointInfo[]>();
  const vlApi = useRef<VirtualizedListApi>(null);

  const isRefreshing = useRef(false);
  const [scrollVersion, setScrollVersion] = useState(0);
  const [viewVersion, setViewVersion] = useState(0);

  // --- State of the memory view
  const [firstAddr, setFirstAddr] = useState(0);
  const [lastAddr, setLastAddr] = useState(0);

  const injectionVersion = useSelector(s => s.compilation?.injectionVersion);
  const bpsVersion = useSelector(s => s.emulatorState?.breakpointsVersion);

  // --- We need to use a reference to autorefresh, as we pass this info to another trhead
  const cachedRefreshState = useRef<CachedRefreshState>({
    autoRefresh,
    viewMode,
    romPage,
    ramBank
  });

  // --- Save the current view state
  const saveViewState = () => {
    const mergedState: BankedMemoryPanelViewState = {
      topAddress,
      autoRefresh,
      viewMode,
      prevViewMode,
      romPage,
      ramBank,
      bankLabel,
      ram,
      screen,
      disassRange
    };
    documentHubService.saveActiveDocumentState(mergedState);
  };

  // --- Save viewState changed
  useEffect(() => {
    saveViewState();
    cachedRefreshState.current = {
      autoRefresh,
      viewMode,
      romPage,
      ramBank
    };
  }, [
    topAddress,
    autoRefresh,
    viewMode,
    prevViewMode,
    romPage,
    ramBank,
    bankLabel,
    ram,
    screen,
    disassRange
  ]);

  // --- Initial view: refresh the disassembly list and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshDisassembly();
    setScrollVersion(scrollVersion + 1);
  });

  // --- Refresh the disassembly view
  // --- This function refreshes the disassembly
  const refreshDisassembly = async () => {
    if (isRefreshing.current) return;

    // --- Obtain the memory contents
    isRefreshing.current = true;
    try {
      let partition: number | undefined;
      if (!cachedRefreshState.current.autoRefresh) {
        if (cachedRefreshState.current.viewMode === "rom") {
          partition = -(cachedRefreshState.current.romPage + 1);
        } else if (cachedRefreshState.current.viewMode === "ram") {
          partition = cachedRefreshState.current.ramBank ?? 0;
        }
      }

      const getMemoryResponse = await messenger.sendMessage({
        type: "EmuGetMemory",
        partition
      });
      if (getMemoryResponse.type === "ErrorResponse") {
        reportMessagingError(
          `EmuGetMemory request failed: ${getMemoryResponse.message}`
        );
      } else if (getMemoryResponse.type !== "EmuGetMemoryResponse") {
        reportUnexpectedMessageType(getMemoryResponse.type);
      } else {
        const memory = getMemoryResponse.memory;
        setPausedPc(getMemoryResponse.pc);
        breakpoints.current = getMemoryResponse.memBreakpoints;
        setCurrentRomPage(-(getMemoryResponse.selectedRom ?? 0) - 1);
        setCurrentRamBank(getMemoryResponse.selectedBank ?? 0);

        // --- Specify memory sections to disassemble
        const memSections: MemorySection[] = [];

        if (cachedRefreshState.current.autoRefresh) {
          // --- Disassemble only one KB from the current PC value
          memSections.push(
            new MemorySection(
              getMemoryResponse.pc,
              (getMemoryResponse.pc + 1024) & 0xffff,
              MemorySectionType.Disassemble
            )
          );
        } else if (showRamOption || showScreenOption) {
          // --- Use the memory segments according to the "ram" and "screen" flags
          memSections.push(
            new MemorySection(0x0000, 0x3fff, MemorySectionType.Disassemble)
          );
          if (ram) {
            if (screen) {
              memSections.push(
                new MemorySection(0x4000, 0xffff, MemorySectionType.Disassemble)
              );
            } else {
              memSections.push(
                new MemorySection(0x5b00, 0xffff, MemorySectionType.Disassemble)
              );
            }
          } else if (screen) {
            memSections.push(
              new MemorySection(0x4000, 0x5aff, MemorySectionType.Disassemble)
            );
          }
        } else {
          // --- Disassemble the whole memory
          memSections.push(
            new MemorySection(0x0000, 0xffff, MemorySectionType.Disassemble)
          );
        }

        // --- Disassemble the specified memory segments
        const disassembler = new Z80Disassembler(
          memSections,
          memory,
          getMemoryResponse.partitionLabels,
          {
            noLabelPrefix: false
          }
        );

        // --- Set up partition offset
        if (partition !== undefined && !autoRefresh) {
          let page = disassRange ? parseInt(disassRange, 10) : 0;
          if (isNaN(page)) {
            page = 0;
          }
          disassembler.setAddressOffset(page * 0x4000);
        }

        if (customDisassembly && typeof customDisassembly === "function") {
          const customPlugin = customDisassembly() as ICustomDisassembler;
          disassembler.setCustomDisassembler(customPlugin);
        }
        const output = await disassembler.disassemble(
          0x0000,
          (viewMode === "full" || autoRefresh) ? 0xffff : 0x3fff
        );
        const items = output.outputItems;
        cachedItems.current = items;

        // --- Display the current address range
        if (items.length > 0) {
          setFirstAddr(items[0].address);
          setLastAddr(items[items.length - 1].address);
        }

        // --- Scroll to the top when following PC
        if (cachedRefreshState.current.autoRefresh && items && items.length > 0) {
          setTopAddress(items[0].address);
          setScrollVersion(scrollVersion + 1);
        }
      }
    } finally {
      isRefreshing.current = false;
      setViewVersion(viewVersion + 1);
    }
  };

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async function () {
      switch (machineState) {
        case MachineControllerState.Paused:
        case MachineControllerState.Stopped:
          await refreshDisassembly();
          break;
      }
    })();
  }, [machineState]);

  // --- Refresh when the follow PC option changes
  useEffect(() => {
    refreshDisassembly();
  }, [
    autoRefresh,
    bpsVersion,
    injectionVersion,
    viewMode,
    disassRange,
    romPage,
    ramBank
  ]);

  // --- Take care of refreshing the screen
  useStateRefresh(500, async () => {
    if (cachedRefreshState.current.autoRefresh) {
      await refreshDisassembly();
    }
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (cachedItems.current) {
      const idx = cachedItems.current.findIndex(
        di => di.address >= (topAddress ?? 0)
      );
      if (idx >= 0) {
        vlApi.current?.scrollToIndex(idx, {
          align: "start"
        });
      }
    }
  }, [scrollVersion]);

  const OptionsBar = () => {
    return (
      <>
        {!autoRefresh && viewMode !== "full" && (
          <>
            <LabelSeparator width={8} />
            <Label text='Bank range:' />
            <LabelSeparator width={8} />
            <Dropdown
              placeholder='Size...'
              options={Bank16KOptions}
              value={disassRange}
              width={120}
              iconSize={18}
              fontSize='0.8rem'
              onSelectionChanged={async option => {
                setDisassRange(option);
              }}
            />
            <LabelSeparator width={8} />
            <ToolbarSeparator small={true} />
          </>
        )}
        {showRoms && viewMode !== "full" && (
          <>
            <LabeledGroup
              label='ROM: '
              title='Select the ROM to display'
              values={range(0, romPages - 1)}
              marked={currentRomPage}
              selected={viewMode === "rom" ? romPage : -1}
              clicked={v => {
                setViewMode("rom");
                setPrevViewMode(viewMode);
                setRomPage(v);
              }}
            />
            <ToolbarSeparator small={true} />
            <LabeledGroup
              label='RAM Bank: '
              title='Select the RAM Bank to display'
              values={range(0, ramBanks - 1)}
              marked={currentRamBank}
              selected={viewMode === "ram" ? ramBank : -1}
              clicked={v => {
                setViewMode("ram");
                setPrevViewMode(viewMode), setRamBank(v);
              }}
            />
          </>
        )}
        {showRamOption && viewMode === "full" && (
          <>
            <LabeledSwitch
              value={ram}
              label='RAM:'
              title='Disasseble RAM?'
              clicked={setRam}
            />
            <ToolbarSeparator small={true} />
          </>
        )}
        {showScreenOption && viewMode === "full" && (
          <>
            <LabeledSwitch
              value={screen}
              label='Screen:'
              title='Disassemble screen?'
              clicked={setScreen}
            />
            <ToolbarSeparator small={true} />
          </>
        )}
        {allowViews && (
          <>
            {viewMode !== "full" && showScreenOption && (
              <ToolbarSeparator small={true} />
            )}
            <LabeledSwitch
              value={bankLabel}
              label='Bank Label:'
              title='Display bank label information?'
              clicked={setBankLabel}
            />
          </>
        )}
      </>
    );
  };

  console.log(cachedItems.current.length);

  return (
    <div className={styles.panel}>
      <div ref={headerRef} className={styles.header} tabIndex={-1}>
        <LabelSeparator width={4} />
        <LabeledText
          label='Display:'
          value={`${toHexa4(firstAddr)}-${toHexa4(lastAddr)}`}
        />
        <ToolbarSeparator small={true} />
        <AddressInput
          label='Go To:'
          clearOnEnter={true}
          onAddressSent={async address => {
            setTopAddress(address);
            setScrollVersion(scrollVersion + 1);
            if (headerRef.current) headerRef.current.focus();
          }}
        />
        <LabelSeparator width={8} />
        <ToolbarSeparator small={true} />
        <SmallIconButton
          iconName='refresh'
          title={"Refresh now"}
          clicked={async () => {
            refreshDisassembly();
            dispatch(setIdeStatusMessageAction("Disassembly refreshed", true));
          }}
        />
        <SmallIconButton
          iconName={
            pausedPc < topAddress ? "arrow-circle-up" : "arrow-circle-down"
          }
          title={"Go to the PC address"}
          enable={
            machineState === MachineControllerState.Paused ||
            machineState === MachineControllerState.Stopped
          }
          clicked={() => {
            setTopAddress(pausedPc);
            setScrollVersion(scrollVersion + 1);
          }}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={autoRefresh}
          label='Follow PC:'
          title='Follow the changes of PC'
          clicked={setAutoRefresh}
        />
        {allowViews && !autoRefresh && (
          <>
            <ToolbarSeparator small={true} />
            <LabeledSwitch
              value={viewMode === "full"}
              label='64K View'
              title='Show the full 64K memory'
              clicked={v => {
                setViewMode(v ? "full" : prevViewMode);
                setPrevViewMode(v ? viewMode : "full");
              }}
            />
            {allowBankInput && viewMode !== "full" && (
              <>
                <ToolbarSeparator small={true} />
                <AddressInput
                  label='Bank:'
                  eightBit={true}
                  clearOnEnter={false}
                  initialValue={ramBank}
                  onAddressSent={async bank => {
                    setViewMode("ram");
                    setPrevViewMode(viewMode);
                    setRamBank(bank);
                    setTopAddress(0);
                    if (headerRef.current) headerRef.current.focus();
                    setScrollVersion(scrollVersion + 1);
                  }}
                />
              </>
            )}
          </>
        )}
      </div>
      {allowViews && (
        <div className={styles.header}>
          <OptionsBar />
        </div>
      )}
      <div className={styles.headerSeparator} />
      <div className={styles.disassemblyWrapper}>
        <VirtualizedListView
          items={cachedItems.current}
          approxSize={20}
          fixItemHeight={true}
          vlApiLoaded={api => (vlApi.current = api)}
          scrolled={async () => {
            if (!vlApi.current || !cachedItems.current) return;

            const range = vlApi.current.getRange();
            setTopAddress(cachedItems.current[range.startIndex].address);
          }}
          itemRenderer={idx => {
            const address = cachedItems.current?.[idx].address;
            const execPoint = address === pausedPc;
            const breakpoint = breakpoints.current.find(
              bp => bp.address === address || bp.resolvedAddress === address
            );
            const item = cachedItems.current?.[idx];
            return (
              <div
                className={classnames(styles.item, {
                  [styles.even]: idx % 2 == 0
                })}
              >
                <LabelSeparator width={4} />
                <BreakpointIndicator
                  partition={breakpoint?.partition}
                  address={
                    breakpoint?.resource
                      ? getBreakpointKey(breakpoint)
                      : address
                  }
                  hasBreakpoint={!!breakpoint}
                  current={execPoint}
                  disabled={breakpoint?.disabled ?? false}
                />
                {bankLabel &&
                  showBanks &&
                  (autoRefresh || viewMode === "full") && (
                    <>
                      <LabelSeparator width={4} />
                      <Label
                        text={item?.partition?.toString() ?? ""}
                        width={18}
                      />
                      <Label text=':' width={6} />
                    </>
                  )}
                {bankLabel &&
                  showBanks &&
                  !autoRefresh &&
                  viewMode === "ram" && (
                    <>
                      <LabelSeparator width={4} />
                      <Label text={toHexa2(ramBank ?? 0)} width={18} />
                      <Label text=':' width={6} />
                    </>
                  )}
                {bankLabel &&
                  showBanks &&
                  !autoRefresh &&
                  viewMode === "rom" && (
                    <>
                      <LabelSeparator width={4} />
                      <Label text={"R" + (romPage ?? 0)} width={18} />
                      <Label text=':' width={6} />
                    </>
                  )}
                <LabelSeparator width={4} />
                <Label text={`${toHexa4(address)}`} width={40} />
                <Secondary text={item?.opCodes} width={100} />
                <Label
                  text={item?.hasLabel ? `L${toHexa4(address)}:` : ""}
                  width={80}
                />
                <Value text={item?.instruction} />
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};

export const createBankedDisassemblyPanel = ({
  document,
  contents
}: DocumentProps) => (
  <BankedDisassemblyPanel
    document={document}
    contents={contents}
    apiLoaded={() => {}}
  />
);
