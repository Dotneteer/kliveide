import styles from "./DisassemblyPanel.module.scss";
import { useEffect, useRef, useState } from "react";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import {
  CT_CUSTOM_DISASSEMBLER,
  CT_DISASSEMBLER,
  MF_BANK,
  MF_ROM,
  MI_Z88,
  MI_ZXNEXT
} from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { AddressInput } from "@renderer/controls/AddressInput";
import { Label, LabelSeparator, Secondary, Value } from "@renderer/controls/Labels";
import { SmallIconButton } from "@renderer/controls/IconButton";
import {
  incProjectFileVersionAction,
  setIdeStatusMessageAction,
  setWorkspaceSettingsAction
} from "@common/state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import classnames from "classnames";
import { BreakpointIndicator } from "./BreakpointIndicator";
import { getBreakpointKey } from "@common/utils/breakpoints";
import { toDecimal3, toDecimal5, toHexa2, toHexa4 } from "../services/ide-commands";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import Dropdown, { DropdownOption } from "@renderer/controls/Dropdown";
import { FullPanel } from "@renderer/controls/new/Panels";
import { PanelHeader } from "./helpers/PanelHeader";
import { Text } from "@renderer/controls/generic/Text";
import BankDropdown from "@renderer/controls/new/BankDropdown";
import NextBankDropdown from "@renderer/controls/new/NextBankDropdown";
import { DISASSEMBLY_EDITOR } from "@common/state/common-ids";
import { useMainApi } from "@renderer/core/MainApi";
import { DisassemblyItem, MemorySection } from "../disassemblers/common-types";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { ICustomDisassembler } from "../disassemblers/z80-disassembler/custom-disassembly";
import { MemorySectionType } from "@abstractions/MemorySection";

type BankedMemoryPanelViewState = {
  topAddress?: number;
  isFullView?: boolean;
  autoRefresh?: boolean;
  currentSegment?: number;
  decimalView?: boolean;
  ram?: boolean;
  screen?: boolean;
  disassOffset?: number;
  bankLabel?: boolean;
};

export type CachedRefreshState = {
  isFullView: boolean;
  autoRefresh: boolean;
  screen: boolean;
  ram: boolean;
  currentSegment: number;
  decimalView: boolean;
};

const BankedDisassemblyPanel = ({ document }: DocumentProps) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();

  // --- Get the machine information
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const machineId = useSelector((s) => s.emulatorState.machineId);
  const [displayBankMatrix, setDisplayBankMatrix] = useState<boolean>(false);
  const [segmentOptions, setSegmentOptions] = useState<DropdownOption[]>([]);
  const [mem64kLabels, setMem64kLabels] = useState<string[]>([]);
  const [partitionLabels, setPartitionLabels] = useState<Record<number, string>>(null);

  const machineInfo = machineRegistry.find((mi) => mi.machineId === machineId);
  const romPages = machineInfo?.features?.[MF_ROM] ?? 0;
  const showRoms = romPages > 0;
  const ramBanks = machineInfo?.features?.[MF_BANK] ?? 0;
  const showBanks = ramBanks > 0;
  const allowViews = showBanks || showRoms;

  const headerRef = useRef<HTMLDivElement>(null);

  // --- Read the view state of the document
  const viewState = useRef(
    (documentHubService.getDocumentViewState(document.id) as BankedMemoryPanelViewState) ?? {}
  );

  // --- View state variables
  const emuViewVersion = useSelector((s) => s.emulatorState?.emuViewVersion);
  const workspace = useSelector((s) => s.workspaceSettings?.[DISASSEMBLY_EDITOR]);
  const [topAddress, setTopAddress] = useState<number>(
    viewState.current?.topAddress ?? workspace?.topAddress ?? 0
  );
  const [isFullView, setIsFullView] = useState(
    viewState.current?.isFullView ?? workspace?.isFullView ?? true
  );
  const [autoRefresh, setAutoRefresh] = useState(
    viewState.current?.autoRefresh ?? workspace?.autoRefresh ?? true
  );
  const [currentSegment, setCurrentSegment] = useState<number>(
    viewState.current?.currentSegment ?? workspace?.currentSegment ?? 0
  );
  const [bankLabel, setBankLabel] = useState(
    viewState.current?.bankLabel ?? workspace?.bankLabel ?? true
  );

  // --- Display options
  const [decimalView, setDecimalView] = useState(
    viewState.current?.decimalView ?? workspace?.decimalView ?? false
  );
  const [ram, setRam] = useState(viewState.current?.ram ?? workspace?.ram ?? true);
  const [screen, setScreen] = useState(viewState.current?.screen ?? workspace?.screen ?? false);
  const [disassOffset, setDisassOffset] = useState(
    viewState.current?.disassOffset ?? workspace?.disassOffset ?? 0
  );

  const disassemblerFactory = machineInfo.toolInfo?.[CT_DISASSEMBLER];
  const customDisassembly = machineInfo.toolInfo?.[CT_CUSTOM_DISASSEMBLER];

  const [pausedPc, setPausedPc] = useState(0);

  // --- Internal state values for disassembly
  const cachedItems = useRef<DisassemblyItem[]>([]);
  const breakpoints = useRef<BreakpointInfo[]>();
  const vlApi = useRef<VListHandle>(null);

  const isRefreshing = useRef(false);
  const [toScroll, setToScroll] = useState<number>(null);
  const [scrollVersion, setScrollVersion] = useState(0);
  const [viewVersion, setViewVersion] = useState(0);

  const injectionVersion = useSelector((s) => s.compilation?.injectionVersion);
  const bpsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);

  // --- We need to use a reference to autorefresh, as we pass this info to another trhead
  const cachedRefreshState = useRef<CachedRefreshState>({
    isFullView,
    currentSegment,
    decimalView,
    autoRefresh,
    screen,
    ram
  });

  // --- Obtain available partition labels for the current machine type
  useEffect(() => {
    const machine = machineRegistry.find((mi) => mi.machineId === machineId);
    const romPagesValue = machine?.features?.[MF_ROM] ?? 0;
    const ramBankValue = machine?.features?.[MF_BANK] ?? 0;
    if (romPagesValue === 0 && ramBankValue === 0) {
      setIsFullView(true);
      setScrollVersion(scrollVersion + 1);
    }
    setDisplayBankMatrix(ramBankValue > 8 || romPagesValue > 8);
    (async function () {
      const options: DropdownOption[] = [];
      const labels = await emuApi.getPartitionLabels();
      setPartitionLabels(labels);
      if (ramBankValue <= 8) {
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
      }
    })();
  }, [machineId]);

  // --- Save the current view state
  const saveViewState = () => {
    const mergedState: BankedMemoryPanelViewState = {
      topAddress,
      isFullView,
      currentSegment,
      decimalView,
      bankLabel,
      autoRefresh,
      ram,
      screen,
      disassOffset
    };
    documentHubService.saveActiveDocumentState(mergedState);
    dispatch(setWorkspaceSettingsAction(DISASSEMBLY_EDITOR, mergedState));
    (async () => {
      await mainApi.saveProject();
      dispatch(incProjectFileVersionAction());
    })();
  };

  // --- Refresh the disassembly view
  // --- This function refreshes the disassembly
  const refreshDisassembly = async () => {
    if (isRefreshing.current) return;

    // --- Obtain the memory contents
    isRefreshing.current = true;
    try {
      // --- Obtain the memory contents
      let partition: number | undefined;

      // --- Use partitions when multiple ROMs or Banks available
      if (!cachedRefreshState.current.isFullView) {
        partition = cachedRefreshState.current.currentSegment;
        if (isNaN(partition)) {
          partition = -1;
        }
      }

      const getMemoryResponse = await emuApi.getMemoryContents(partition);
      setMem64kLabels(getMemoryResponse.partitionLabels);

      const memory = getMemoryResponse.memory;
      setPausedPc(getMemoryResponse.pc);
      breakpoints.current = getMemoryResponse.memBreakpoints;

      // --- Specify memory sections to disassemble
      const memSections: MemorySection[] = [];

      const autoRefreshOpt = cachedRefreshState.current.autoRefresh;
      const screenOpt = cachedRefreshState.current.screen;
      const ramOpt = cachedRefreshState.current.ram;

      if (autoRefreshOpt) {
        // --- Disassemble only one KB from the current PC value
        const pcAddr = getMemoryResponse.pc;
        let endAddr = (pcAddr + 1024) & 0xffff;

        // --- Adjust end address if it wraps around
        if (endAddr < pcAddr) {
          endAddr = 0xffff;
        }

        // --- Make sure vector addresses are included
        if (endAddr > 0xfff9) {
          endAddr = 0xffff;
        }

        if (endAddr > 0xfff9) {
          // --- Make sure vectors are displayed as words
          memSections.push(
            new MemorySection(getMemoryResponse.pc, 0xfff9, MemorySectionType.Disassemble)
          );
          memSections.push(
            new MemorySection(0xfffa, 0xfffb, MemorySectionType.WordArray),
            new MemorySection(0xfffc, 0xfffd, MemorySectionType.WordArray),
            new MemorySection(0xfffe, 0xffff, MemorySectionType.WordArray)
          );
        } else {
          // --- Pure disassembly
          memSections.push(
            new MemorySection(getMemoryResponse.pc, endAddr, MemorySectionType.Disassemble)
          );
        }
      } else {
        const sections = await emuApi.getDisassemblySections({ ram: ramOpt, screen: screenOpt });
        sections.forEach((s) =>
          memSections.push(new MemorySection(s.startAddress, s.endAddress, s.sectionType))
        );
      }

      // --- Disassemble the specified memory segments
      const disassembler = disassemblerFactory(
        memSections,
        memory,
        getMemoryResponse.partitionLabels,
        {
          noLabelPrefix: false,
          allowExtendedSet: machineId === MI_ZXNEXT,
          decimalMode: cachedRefreshState.current.decimalView,
          getRomPage: () => {
            return isFullView
              ? getMemoryResponse.selectedRom
              : currentSegment < 0
                ? -currentSegment - 1
                : -1;
          }
        }
      );

      // --- Set up partition offset
      if (partition !== undefined && !autoRefreshOpt) {
        let page = disassOffset ?? 0;
        if (isNaN(page)) {
          page = 0;
        }
        disassembler.setAddressOffset(page);
      }

      if (customDisassembly && typeof customDisassembly === "function") {
        const customPlugin = customDisassembly() as ICustomDisassembler;
        disassembler.setCustomDisassembler?.(customPlugin);
      }
      const output = await disassembler.disassemble(
        0x0000,
        isFullView || autoRefresh ? 0xffff : 0x3fff
      );
      const items = output.outputItems;
      cachedItems.current = items;

      // --- Scroll to the top when following PC
      if (cachedRefreshState.current.autoRefresh && items && items.length > 0) {
        setTopAddress(items[0].address);
      }
    } finally {
      isRefreshing.current = false;
      setViewVersion(viewVersion + 1);
    }
  };

  // --- Save viewState changed
  useEffect(() => {
    saveViewState();
    cachedRefreshState.current = {
      isFullView,
      autoRefresh,
      currentSegment,
      decimalView,
      screen,
      ram
    };
  }, [
    topAddress,
    decimalView,
    isFullView,
    autoRefresh,
    currentSegment,
    bankLabel,
    ram,
    screen,
    disassOffset
  ]);

  // --- Initial view: refresh the disassembly list and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshDisassembly();
    setScrollVersion(scrollVersion + 1);
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (cachedItems.current && cachedItems.current.length > 0 && toScroll !== null) {
      const idx = cachedItems.current.findIndex((di) => di.address >= (toScroll ?? 0));
      if (idx >= 0) {
        vlApi.current?.scrollToIndex(idx, {
          align: "start"
        });
      }
      setToScroll(null);
    }
  }, [scrollVersion, toScroll, cachedItems.current]);

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
    bpsVersion,
    injectionVersion,
    isFullView,
    decimalView,
    screen,
    ram,
    currentSegment,
    disassOffset,
    emuViewVersion
  ]);

  // --- Take care of refreshing the screen
  useEmuStateListener(emuApi, async () => {
    await refreshDisassembly();
  });

  const bank16KOptions: DropdownOption[] = [];
  for (let i = 0; i < 8; i++) {
    const offset = 0x2000 * i;
    const label = decimalView ? offset.toString() : toHexa4(offset);
    bank16KOptions.push({ value: offset.toString(), label });
  }

  return (
    <FullPanel fontFamily="--monospace-font" fontSize="0.8em">
      <PanelHeader>
        <LabeledSwitch
          value={decimalView}
          label="Decimal"
          title="Use decimal numbers?"
          clicked={(v) => setDecimalView(v)}
        />
        <LabelSeparator width={0} />
        <LabeledSwitch
          value={autoRefresh}
          label="Follow PC"
          title="Follow the changes of PC"
          clicked={async (v) => {
            setAutoRefresh(v);
            if (v) {
              setToScroll(0);
            }
            setScrollVersion(scrollVersion + 1);
            await refreshDisassembly();
          }}
        />
        <SmallIconButton
          iconName="refresh"
          title={"Refresh now"}
          clicked={async () => {
            refreshDisassembly();
            dispatch(setIdeStatusMessageAction("Disassembly refreshed", true));
          }}
        />
        <LabeledSwitch value={ram} label="RAM:" title="Disasseble RAM?" clicked={setRam} />
        <LabeledSwitch
          value={screen}
          label="Screen:"
          title="Disassemble screen?"
          clicked={setScreen}
        />
        <LabeledSwitch
          value={bankLabel}
          label="Bank"
          title="Display bank label information?"
          clicked={setBankLabel}
        />
        <SmallIconButton
          iconName={pausedPc < topAddress ? "arrow-circle-up" : "arrow-circle-down"}
          title={"Go to the PC address"}
          enable={
            machineState === MachineControllerState.Paused ||
            machineState === MachineControllerState.Stopped
          }
          clicked={() => {
            setToScroll(pausedPc);
            setScrollVersion(scrollVersion + 1);
          }}
        />
        <AddressInput
          label="Go To"
          clearOnEnter={true}
          decimalView={false}
          onAddressSent={async (address) => {
            setToScroll(address);
            setScrollVersion(scrollVersion + 1);
            if (headerRef.current) headerRef.current.focus();
          }}
        />
      </PanelHeader>
      {!autoRefresh && allowViews && (
        <PanelHeader>
          <LabeledSwitch
            value={isFullView}
            label="64K View"
            title="Show the full 64K memory"
            clicked={(v) => {
              setIsFullView(v);
            }}
          />
          {!isFullView && (
            <>
              <LabelSeparator width={4} />
              <Text text="Select bank" />
              <LabelSeparator width={4} />
              {!displayBankMatrix && (
                <Dropdown
                  options={segmentOptions}
                  initialValue={currentSegment?.toString()}
                  width={80}
                  onChanged={async (opt) => {
                    setCurrentSegment(parseInt(opt));
                  }}
                />
              )}
              {displayBankMatrix && machineId === MI_Z88 && (
                <BankDropdown
                  initialValue={currentSegment ?? 0}
                  width={48}
                  decimalView={decimalView}
                  onChanged={async (opt) => {
                    setCurrentSegment(opt);
                  }}
                />
              )}
              {displayBankMatrix && machineId === MI_ZXNEXT && (
                <NextBankDropdown
                  banks={224}
                  initialValue={currentSegment ?? 0}
                  width={80}
                  decimalView={decimalView}
                  onChanged={async (opt) => {
                    setCurrentSegment(opt);
                  }}
                />
              )}
              <LabelSeparator width={8} />
              <Text text="Offset" />
              <LabelSeparator width={4} />
              <Dropdown
                options={bank16KOptions}
                initialValue={disassOffset.toString(10)}
                width={68}
                onChanged={async (option) => {
                  setDisassOffset(parseInt(option, 10));
                }}
              />
            </>
          )}
        </PanelHeader>
      )}
      {cachedItems.current && cachedItems.current.length > 0 && (
        <div className={styles.disassemblyWrapper}>
          <VirtualizedList
            items={cachedItems.current}
            apiLoaded={(api) => (vlApi.current = api)}
            overscan={25}
            onScroll={async () => {
              if (!vlApi.current || !cachedItems.current) return;

              const startIndex = vlApi.current.findStartIndex();
              setTopAddress(cachedItems.current[startIndex].address);
            }}
            renderItem={(idx) => {
              // --- Prepare the information to display
              const item = cachedItems.current?.[idx];
              if (!item) return <div></div>;

              const address = item?.address;
              const execPoint = address === pausedPc;
              const breakpoint = breakpoints.current?.find(
                (bp) => bp.address === address || bp.resolvedAddress === address
              );

              // --- Calculate the partition label
              let partitionLabel = isFullView
                ? mem64kLabels[address >> 13]
                : partitionLabels?.[currentSegment];
              let useWidePartitions = false;
              if (showBanks && partitionLabel && decimalView) {
                const partAsNumber = parseInt(partitionLabel, 16);
                if (!isNaN(partAsNumber)) {
                  useWidePartitions = true;
                  partitionLabel = toDecimal3(partAsNumber);
                }
              }

              // --- Propare opcodes
              const opCodes =
                item.opCodes
                  ?.map((oc) => (decimalView ? toDecimal3(oc) : toHexa2(oc)))
                  ?.join(" ") ?? "";

              return (
                <div
                  key={idx}
                  className={classnames(styles.item, {
                    [styles.even]: idx % 2 == 0
                  })}
                >
                  <LabelSeparator width={4} />
                  <BreakpointIndicator
                    showType={false}
                    partition={
                      breakpoint?.partition !== undefined
                        ? partitionLabels[breakpoint.partition] ?? "?"
                        : undefined
                    }
                    address={breakpoint?.resource ? getBreakpointKey(breakpoint) : address}
                    hasBreakpoint={!!breakpoint}
                    current={execPoint}
                    disabled={breakpoint?.disabled ?? false}
                  />
                  {bankLabel && showBanks && (
                    <>
                      <LabelSeparator width={4} />
                      <Label text={partitionLabel} width={useWidePartitions ? 26 : 18} />
                      <Label text=":" width={6} />
                    </>
                  )}
                  <LabelSeparator width={4} />
                  <Label
                    text={decimalView ? toDecimal5(address) : toHexa4(address)}
                    width={decimalView ? 48 : 40}
                  />
                  <Secondary text={opCodes} width={decimalView ? 140 : 100} />
                  <Label
                    text={
                      item?.hasLabel
                        ? `L${decimalView ? toDecimal5(address) : toHexa4(address)}:`
                        : ""
                    }
                    width={60}
                  />
                  <div className={styles.tstates}>
                    {item?.tstates
                      ? `${item?.tstates}${item?.tstates2 ? `/${item.tstates2}` : ""}`
                      : ""}
                  </div>
                  <Value text={item?.instruction} width={160} />
                  {item.hardComment && <Secondary text={"; " + item?.hardComment} />}
                </div>
              );
            }}
          />
        </div>
      )}
    </FullPanel>
  );
};

export const createBankedDisassemblyPanel = ({ document, contents }: DocumentProps) => (
  <BankedDisassemblyPanel document={document} contents={contents} apiLoaded={() => {}} />
);
