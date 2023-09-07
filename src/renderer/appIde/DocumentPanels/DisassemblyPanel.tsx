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
import { useUncommittedState } from "@renderer/core/useUncommittedState";
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
import { LabeledGroup } from "@renderer/controls/LabeledGroup";
import { useDocumentService } from "../services/DocumentServiceProvider";

type DisassemblyViewState = {
  topAddress?: number;
  followPc?: boolean;
  ram?: boolean;
  screen?: boolean;
  fullView?: boolean;
  romSelected?: number;
  ramSelected?: number;
};

const DisassemblyPanel = ({ document }: DocumentProps) => {
  // --- Read the view state of the document
  const viewState = useRef((document.stateValue as DisassemblyViewState) ?? {});
  const topAddress = useRef(viewState.current?.topAddress ?? 0);

  // --- Use these app state variables
  const machineState = useSelector(s => s.emulatorState?.machineState);
  const machineId = useSelector(s => s.emulatorState.machineId);
  const bpsVersion = useSelector(s => s.emulatorState?.breakpointsVersion);
  const injectionVersion = useSelector(s => s.compilation?.injectionVersion);

  // --- Get the services used in this component
  const dispatch = useDispatch();
  const { messenger } = useRendererContext();
  const documentService = useDocumentService();

  // --- Use these options to set disassembly options. As disassembly view is async, we sometimes
  // --- need to use state changes not yet committed by React.
  const [followPc, refPc, setFollowPc] = useUncommittedState(
    viewState.current.followPc ?? true
  );
  const [ram, refRam, setRam] = useUncommittedState(
    viewState.current.ram ?? true
  );
  const [screen, refScreen, setScreen] = useUncommittedState(
    viewState.current.screen ?? false
  );
  const [pausedPc, setPausedPc] = useState(0);

  const [fullView, refFullView, setFullView] = useUncommittedState(
    viewState.current?.fullView ?? true
  );
  const [romPage, refRomPage, setRomPage] = useUncommittedState(
    viewState.current?.romSelected ?? null
  );
  const [ramBank, refRamBank, setRamBank] = useUncommittedState(
    viewState.current?.ramSelected ?? null
  );
  const [currentRomPage, setCurrentRomPage] = useState<number>();
  const [currentRamBank, setCurrentRamBank] = useState<number>();
  const [lastRomPage, setLastRomPage] = useState<number>(null);
  const [lastRamBank, setLastRamBank] = useState<number>(null);

  // --- Other visual state values
  const [firstAddr, setFirstAddr] = useState(0);
  const [lastAddr, setLastAddr] = useState(0);

  // --- Internal state values for disassembly
  const cachedItems = useRef<DisassemblyItem[]>([]);
  const breakpoints = useRef<BreakpointInfo[]>();
  const vlApi = useRef<VirtualizedListApi>(null);
  const refreshedOnStateChange = useRef(false);
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
      if (!refPc.current) {
        if (!fullView) {
          if (romPage != undefined) {
            partition = -(romPage + 1);
          } else {
            partition = ramBank ?? 0;
          }
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

        if (refPc.current) {
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
        if (refPc.current) {
          topAddress.current = items[0].address;
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

  // --- This function directs the current disassembly to the PC address (provided that is visible)
  const goToPcAddress = () => {
    topAddress.current = pausedPc;
    setScrollVersion(scrollVersion + 1);
  };

  // --- Initial view: refresh the disassembly lint and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshDisassembly();
    await refreshMemoryPagingInfo();
    setScrollVersion(scrollVersion + 1);
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (cachedItems.current) {
      const idx = cachedItems.current.findIndex(
        di => di.address >= (topAddress.current ?? 0)
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
          refreshedOnStateChange.current = true;
      }
    })();
  }, [machineState]);

  // --- Whenever the state of view options change
  useEffect(() => {
    refreshDisassembly();
    refreshMemoryPagingInfo();
  }, [ram, screen, followPc, bpsVersion, pausedPc, injectionVersion]);

  // --- Take care of refreshing the screen
  useStateRefresh(500, async () => {
    await refreshMemoryPagingInfo();
    if (refPc.current || refreshedOnStateChange.current) {
      await refreshDisassembly();
      refreshedOnStateChange.current = false;
    }
  });

  // --- Save the new view state whenever the view is scrolled
  const scrolled = () => {
    if (!vlApi.current || !cachedItems.current) return;

    const range = vlApi.current.getRange();
    topAddress.current = cachedItems.current[range.startIndex].address;
    saveViewState();
  };

  // --- Save the current view state
  const saveViewState = () => {
    const mergedState: DisassemblyViewState = {
      followPc: refPc.current,
      ram: refRam.current,
      screen: refScreen.current,
      topAddress: topAddress.current,
      fullView: refFullView.current,
      romSelected: refRomPage.current,
      ramSelected: refRamBank.current
    };
    documentService.saveActiveDocumentState(mergedState);
  };

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
            pausedPc < topAddress.current
              ? "arrow-circle-up"
              : "arrow-circle-down"
          }
          title={"Go to the PC address"}
          enable={
            machineState === MachineControllerState.Paused ||
            machineState === MachineControllerState.Stopped
          }
          clicked={() => goToPcAddress()}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={followPc}
          setterFn={setFollowPc}
          label='Follow PC:'
          title='Follow the changes of PC'
          clicked={() => saveViewState()}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={ram}
          setterFn={setRam}
          label='RAM:'
          title='Disasseble RAM?'
          clicked={() => saveViewState()}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={screen}
          setterFn={setScreen}
          label='Screen:'
          title='Disasseble screen?'
          clicked={() => saveViewState()}
        />
        <ToolbarSeparator small={true} />
        <ValueLabel text={`${toHexa4(firstAddr)} - ${toHexa4(lastAddr)}`} />
        <LabelSeparator width={4} />
        <ToolbarSeparator small={true} />
        <AddressInput
          label='Go To:'
          onAddressSent={async address => {
            topAddress.current = address;
            setScrollVersion(scrollVersion + 1);
          }}
        />
      </div>
      {machineId === "sp128" && !followPc && (
        <div className={styles.header}>
          <LabeledSwitch
            value={fullView}
            setterFn={setFullView}
            label='Full View:'
            title='Show the full 64K memory'
            clicked={async () => {
              if (refFullView.current) {
                setRomPage(null);
                setRamBank(null);
              } else {
                if (lastRomPage === null && lastRamBank === null) {
                  setRomPage(0);
                } else {
                  setRomPage(lastRomPage);
                  setRamBank(lastRamBank);
                }
              }
              saveViewState();
              await refreshDisassembly();
              await refreshMemoryPagingInfo();
            }}
          />
          <ToolbarSeparator small={true} />
          <LabeledGroup
            label='ROM: '
            title='Select the ROM to display'
            values={[0, 1]}
            marked={currentRomPage}
            selected={romPage}
            clicked={async v => {
              setRomPage(v);
              setLastRomPage(v);
              setRamBank(null);
              setLastRamBank(null);
              setFullView(false);
              saveViewState();
              await refreshDisassembly();
              await refreshMemoryPagingInfo();
            }}
          />
          <ToolbarSeparator small={true} />
          <LabeledGroup
            label='RAM Bank: '
            title='Select the RAM Bank to display'
            values={[0, 1, 2, 3, 4, 5, 6, 7]}
            marked={currentRamBank}
            selected={ramBank}
            clicked={async v => {
              setRamBank(v);
              setLastRamBank(v);
              setRomPage(null);
              setLastRomPage(null);
              setFullView(false);
              saveViewState();
              await refreshDisassembly();
              await refreshMemoryPagingInfo();
            }}
          />
        </div>
      )}

      <div className={styles.disassemblyWrapper}>
        <VirtualizedListView
          items={cachedItems.current}
          approxSize={20}
          fixItemHeight={false}
          vlApiLoaded={api => (vlApi.current = api)}
          scrolled={scrolled}
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

export const createDisassemblyPanel = ({ document, data }: DocumentProps) => (
  <DisassemblyPanel document={document} data={data} apiLoaded={() => {}} />
);
