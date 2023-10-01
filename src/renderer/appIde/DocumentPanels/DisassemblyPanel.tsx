import { AddressInput } from "@controls/AddressInput";
import { SmallIconButton } from "@controls/IconButton";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { LabelSeparator, Label, Secondary, Value } from "@controls/Labels";
import { ToolbarSeparator } from "@controls/ToolbarSeparator";
import { VirtualizedListApi } from "@controls/VirtualizedList";
import { VirtualizedListView } from "@controls/VirtualizedListView";
import {
  useSelector,
  useDispatch,
  useRendererContext
} from "@renderer/core/RendererProvider";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import classnames from "@renderer/utils/classnames";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { setIdeStatusMessageAction } from "@state/actions";
import { useRef, useState, useEffect } from "react";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { toHexa4 } from "../services/ide-commands";
import { useStateRefresh } from "../useStateRefresh";
import {
  DisassemblyItem,
  MemorySection,
  MemorySectionType
} from "../z80-disassembler/disassembly-helper";
import { Z80Disassembler } from "../z80-disassembler/z80-disassembler";
import { BreakpointIndicator } from "./BreakpointIndicator";
import styles from "./DisassemblyPanel.module.scss";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";
import { getBreakpointKey } from "@common/utils/breakpoints";
import { useDocumentHubService } from "../services/DocumentServiceProvider";
import { CachedRefreshState, MemoryBankBar, ViewMode } from "./MemoryBankBar";
import { machineRegistry } from "@renderer/registry";

type DisassemblyViewState = {
  topAddress?: number;
  ram?: boolean;
  screen?: boolean;
  autoRefresh?: boolean;
  viewMode?: ViewMode;
  romPage?: number;
  ramBank?: number;
};

const DisassemblyPanel = ({
  viewState
}: DocumentProps<DisassemblyViewState>) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const { messenger } = useRendererContext();
  const documentHubService = useDocumentHubService();

  const [topAddress, setTopAddress] = useState(viewState?.topAddress ?? 0);

  // --- Use these app state variables
  const machineState = useSelector(s => s.emulatorState?.machineState);
  const machineId = useSelector(s => s.emulatorState.machineId);
  const machineInfo = machineRegistry.find(mi => mi.machineId === machineId);
  const romsNum = machineInfo.roms ?? 1;
  const banksNum = machineInfo.banks ?? 0;
  const injectionVersion = useSelector(s => s.compilation?.injectionVersion);
  const bpsVersion = useSelector(s => s.emulatorState?.breakpointsVersion);

  // --- Use these options to set disassembly options. As disassembly view is async, we sometimes
  // --- need to use state changes not yet committed by React.
  const [autoRefresh, setAutoRefresh] = useState(
    viewState?.autoRefresh ?? true
  );
  const [ram, setRam] = useState(viewState?.ram ?? true);
  const [screen, setScreen] = useState(viewState?.screen ?? false);
  const [pausedPc, setPausedPc] = useState(0);

  const [viewMode, setViewMode] = useState(viewState?.viewMode ?? "full");
  const [romPage, setRomPage] = useState(viewState?.romPage ?? 0);
  const [ramBank, setRamBank] = useState(viewState?.ramBank ?? 0);

  // --- These state variables store values for "rom" and "ram" views
  const [prevViewMode, setPrevViewMode] = useState<ViewMode>("rom");
  const [currentRomPage, setCurrentRomPage] = useState<number>();
  const [currentRamBank, setCurrentRamBank] = useState<number>();

  // --- We need to use a reference to autorefresh, as we pass this info to another trhead
  const cachedRefreshState = useRef<CachedRefreshState>({
    autoRefresh,
    viewMode,
    romPage,
    ramBank
  });

  // --- Other visual state values
  const [firstAddr, setFirstAddr] = useState(0);
  const [lastAddr, setLastAddr] = useState(0);

  // --- Internal state values for disassembly
  const cachedItems = useRef<DisassemblyItem[]>([]);
  const breakpoints = useRef<BreakpointInfo[]>();
  const vlApi = useRef<VirtualizedListApi>(null);
  const isRefreshing = useRef(false);
  const [scrollVersion, setScrollVersion] = useState(0);
  const [viewVersion, setViewVersion] = useState(0);

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
      const response = await messenger.sendMessage({
        type: "EmuGetMemory",
        partition
      });
      if (response.type === "ErrorResponse") {
        reportMessagingError(
          `EmuGetMemory request failed: ${response.message}`
        );
      } else if (response.type !== "EmuGetMemoryResponse") {
        reportUnexpectedMessageType(response.type);
      } else {
        const memory = response.memory;
        setPausedPc(response.pc);
        breakpoints.current = response.memBreakpoints;

        // --- Specify memory sections to disassemble
        const memSections: MemorySection[] = [];

        if (cachedRefreshState.current.autoRefresh) {
          // --- Disassemble only one KB from the current PC value
          memSections.push(
            new MemorySection(
              response.pc,
              (response.pc + 1024) & 0xffff,
              MemorySectionType.Disassemble
            )
          );
        } else {
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
        }

        // --- Disassemble the specified memory segments
        const disassembler = new Z80Disassembler(memSections, memory, {
          noLabelPrefix: false
        });
        const output = await disassembler.disassemble(0x0000, 0xffff);
        const items = output.outputItems;
        cachedItems.current = items;

        // --- Display the current address range
        if (items.length > 0) {
          setFirstAddr(items[0].address);
          setLastAddr(items[items.length - 1].address);
        }

        // --- Scroll to the top when following PC
        if (cachedRefreshState.current.autoRefresh) {
          setTopAddress(items[0].address);
          setScrollVersion(scrollVersion + 1);
        }

        // --- Obtain ULA information
        const ulaResponse = await messenger.sendMessage({
          type: "EmuGetUlaState"
        });
        if (ulaResponse.type === "ErrorResponse") {
          reportMessagingError(
            `EmuGetUlaState request failed: ${ulaResponse.message}`
          );
        } else if (ulaResponse.type !== "EmuGetUlaStateResponse") {
          reportUnexpectedMessageType(ulaResponse.type);
        } else {
          setCurrentRomPage(ulaResponse.romP);
          setCurrentRamBank(ulaResponse.ramB);
        }
      }
    } finally {
      isRefreshing.current = false;
      setViewVersion(viewVersion + 1);
    }
  };

  // --- This function refreshes the disassembly
  const refreshMemoryPagingInfo = async () => {
    if (isRefreshing.current) return;

    // --- Obtain the memory contents
    isRefreshing.current = true;
    try {
      // --- Obtain ULA information
      const ulaResponse = await messenger.sendMessage({
        type: "EmuGetUlaState"
      });
      if (ulaResponse.type === "ErrorResponse") {
        reportMessagingError(
          `EmuGetUlaState request failed: ${ulaResponse.message}`
        );
      } else if (ulaResponse.type !== "EmuGetUlaStateResponse") {
        reportUnexpectedMessageType(ulaResponse.type);
      } else {
        setCurrentRomPage(ulaResponse.romP);
        setCurrentRamBank(ulaResponse.ramB);
      }
    } finally {
      isRefreshing.current = false;
      setViewVersion(viewVersion + 1);
    }
  };

  // --- Initial view: refresh the disassembly lint and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshDisassembly();
    await refreshMemoryPagingInfo();
    setScrollVersion(scrollVersion + 1);
  });

  // --- Save view state whenever view parameters change
  useEffect(() => {
    const mergedState: DisassemblyViewState = {
      topAddress,
      ram,
      screen,
      autoRefresh,
      viewMode,
      romPage,
      ramBank
    };
    documentHubService.saveActiveDocumentState(mergedState);
  }, [topAddress, ram, screen, autoRefresh, viewMode, romPage, ramBank]);

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

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async function () {
      switch (machineState) {
        case MachineControllerState.Paused:
        case MachineControllerState.Stopped:
          await refreshDisassembly();
          await refreshMemoryPagingInfo();
      }
    })();
  }, [machineState]);

  // --- Whenever the state of view options change
  useEffect(() => {
    cachedRefreshState.current = {
      autoRefresh,
      viewMode,
      romPage,
      ramBank
    };
    refreshDisassembly();
    refreshMemoryPagingInfo();
  }, [
    ram,
    screen,
    autoRefresh,
    bpsVersion,
    pausedPc,
    injectionVersion,
    viewMode,
    romPage,
    ramBank
  ]);

  // --- Take care of refreshing the screen
  useStateRefresh(500, async () => {
    await refreshMemoryPagingInfo();
    if (cachedRefreshState.current.autoRefresh) {
      await refreshDisassembly();
    }
  });

  return (
    <div className={styles.disassemblyPanel}>
      <div className={styles.header}>
        <SmallIconButton
          iconName='refresh'
          title={"Refresh now"}
          clicked={async () => {
            refreshDisassembly();
            refreshMemoryPagingInfo();
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
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={ram}
          label='RAM:'
          title='Disasseble RAM?'
          clicked={setRam}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={screen}
          label='Screen:'
          title='Disasseble screen?'
          clicked={setScreen}
        />
        <ToolbarSeparator small={true} />
        <ValueLabel text={`${toHexa4(firstAddr)} - ${toHexa4(lastAddr)}`} />
        <LabelSeparator width={4} />
        <ToolbarSeparator small={true} />
        <AddressInput
          label='Go To:'
          onAddressSent={async address => {
            setTopAddress(address);
            setScrollVersion(scrollVersion + 1);
          }}
        />
      </div>
      {!autoRefresh && (
        <MemoryBankBar
          viewMode={viewMode}
          prevViewMode={prevViewMode}
          romPages={romsNum}
          ramBanks={banksNum}
          currentRomPage={currentRomPage}
          currentRamBank={currentRamBank}
          selectedRomPage={romPage}
          selectedRamBank={ramBank}
          changed={args => {
            setViewMode(args.viewMode);
            setPrevViewMode(args.prevViewMode);
            setRomPage(args.romPage);
            setRamBank(args.ramBank);
          }}
        />
      )}

      <div className={styles.disassemblyWrapper}>
        <VirtualizedListView
          items={cachedItems.current}
          approxSize={20}
          fixItemHeight={false}
          vlApiLoaded={api => (vlApi.current = api)}
          scrolled={() => {
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
            return (
              <div
                className={classnames(styles.item, {
                  [styles.even]: idx % 2 == 0
                })}
              >
                <LabelSeparator width={4} />
                <BreakpointIndicator
                  address={
                    breakpoint?.resource
                      ? getBreakpointKey(breakpoint)
                      : address
                  }
                  hasBreakpoint={!!breakpoint}
                  current={execPoint}
                  disabled={breakpoint?.disabled ?? false}
                />
                <LabelSeparator width={4} />
                <Label text={`${toHexa4(address)}`} width={40} />
                <Secondary
                  text={cachedItems.current?.[idx].opCodes}
                  width={100}
                />
                <Label
                  text={
                    cachedItems.current?.[idx].hasLabel
                      ? `L${toHexa4(address)}:`
                      : ""
                  }
                  width={80}
                />
                <Value text={cachedItems.current?.[idx].instruction} />
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};

type LabelProps = {
  text: string;
};

const ValueLabel = ({ text }: LabelProps) => {
  return <div className={styles.valueLabel}>{text}</div>;
};

export const createDisassemblyPanel = ({ viewState }: DocumentProps) => (
  <DisassemblyPanel viewState={viewState} apiLoaded={() => {}} />
);
