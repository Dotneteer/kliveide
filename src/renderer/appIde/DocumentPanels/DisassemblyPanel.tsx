import styles from "./DisassemblyPanel.module.scss";
import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import {
  CT_CUSTOM_DISASSEMBLER,
  CT_DISASSEMBLER
} from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import {
  incProjectFileVersionAction,
  setIdeStatusMessageAction,
  setWorkspaceSettingsAction
} from "@common/state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { DISASSEMBLY_EDITOR } from "@common/state/common-ids";
import { useMainApi } from "@renderer/core/MainApi";
import {
  type CachedRefreshState,
  useDisassemblyViewStatePersistence,
  useLoadedDisassemblyViewState
} from "./disassemblyViewState";
import { useDisassemblyMachineSetup } from "./useDisassemblyMachineSetup";
import {
  type DisassemblerFactory,
  useDisassemblyRefresh
} from "./useDisassemblyRefresh";
import { DisassemblyRow } from "./DisassemblyRow";
import {
  createDisassemblyOffsetOptions,
  DisassemblyBankToolbar,
  DisassemblyToolbar
} from "./DisassemblyToolbars";

const DISASSEMBLY_ROW_ITEM_SIZE = 18;

const BankedDisassemblyPanel = ({ document }: DocumentProps) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();

  // --- Get the machine information
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const machineId = useSelector((s) => s.emulatorState.machineId);

  const machineInfo = machineRegistry.find((mi) => mi.machineId === machineId);
  const machineSetup = useDisassemblyMachineSetup(machineId, emuApi);

  // --- Read the view state of the document
  const loadedViewState = useLoadedDisassemblyViewState(documentHubService, document);

  // --- View state variables
  const emuViewVersion = useSelector((s) => s.emulatorState?.emuViewVersion);
  const workspace = useSelector((s) => s.workspaceSettings?.[DISASSEMBLY_EDITOR]);
  const [topAddress, setTopAddress] = useState<number>(
    loadedViewState?.topAddress ?? workspace?.topAddress ?? 0
  );
  const [isFullView, setIsFullView] = useState(
    loadedViewState?.isFullView ?? workspace?.isFullView ?? true
  );
  const [autoRefresh, setAutoRefresh] = useState(
    loadedViewState?.autoRefresh ?? workspace?.autoRefresh ?? true
  );
  const [currentSegment, setCurrentSegment] = useState<number>(
    loadedViewState?.currentSegment ?? workspace?.currentSegment ?? 0
  );
  const [bankLabel, setBankLabel] = useState(
    loadedViewState?.bankLabel ?? workspace?.bankLabel ?? true
  );

  // --- Display options
  const [decimalView, setDecimalView] = useState(
    loadedViewState?.decimalView ?? workspace?.decimalView ?? false
  );
  const [ram, setRam] = useState(loadedViewState?.ram ?? workspace?.ram ?? true);
  const [screen, setScreen] = useState(loadedViewState?.screen ?? workspace?.screen ?? false);
  const [disassOffset, setDisassOffset] = useState(
    loadedViewState?.disassOffset ?? workspace?.disassOffset ?? 0
  );

  const disassemblerFactory = machineInfo?.toolInfo?.[CT_DISASSEMBLER] as
    | DisassemblerFactory
    | undefined;
  const customDisassembly = machineInfo?.toolInfo?.[CT_CUSTOM_DISASSEMBLER];

  // --- Internal state values for disassembly
  const vlApi = useRef<VListHandle>(null);

  const [toScroll, setToScroll] = useState<number>(null);
  const [scrollVersion, setScrollVersion] = useState(0);
  const pendingScrollTopAddress = useRef(topAddress);

  const injectionVersion = useSelector((s) => s.compilation?.injectionVersion);
  const bpsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);

  // --- Refresh work reads these options asynchronously, so keep the latest values in a ref.
  const cachedRefreshState = useRef<CachedRefreshState>({
    isFullView,
    currentSegment,
    decimalView,
    autoRefresh,
    screen,
    ram
  });
  const setFollowPcTopAddress = useCallback((address: number) => {
    setTopAddress(address);
  }, []);
  const {
    breakpointMap,
    items,
    mem64kLabels,
    pausedPc,
    refreshDisassembly
  } = useDisassemblyRefresh({
    cachedRefreshState,
    customDisassembly,
    disassOffset,
    disassemblerFactory,
    emuApi,
    machineId,
    onFollowPcTopAddress: setFollowPcTopAddress
  });

  useDisassemblyViewStatePersistence({
    autoRefresh,
    bankLabel,
    cachedRefreshState,
    currentSegment,
    decimalView,
    disassOffset,
    dispatch,
    documentHubService,
    incProjectFileVersion: incProjectFileVersionAction,
    isFullView,
    mainApi,
    ram,
    screen,
    setWorkspaceSettings: setWorkspaceSettingsAction,
    topAddress
  });

  useEffect(() => {
    if (
      !machineSetup.isInitializing &&
      machineSetup.setupVersion > 0 &&
      !machineSetup.allowViews
    ) {
      setIsFullView(true);
      setScrollVersion((version) => version + 1);
    }
  }, [machineSetup.allowViews, machineSetup.isInitializing, machineSetup.setupVersion]);

  useEffect(() => {
    pendingScrollTopAddress.current = topAddress;
  }, [topAddress]);

  // --- Initial view: refresh the disassembly list and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshDisassembly();
    setScrollVersion((version) => version + 1);
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (items.length > 0 && toScroll !== null) {
      const idx = items.findIndex((di) => di.address >= (toScroll ?? 0));
      if (idx >= 0) {
        vlApi.current?.scrollToIndex(idx, {
          align: "start"
        });
      }
      setToScroll(null);
    }
  }, [items, scrollVersion, toScroll]);

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

  return (
    <FullPanel fontFamily="--monospace-font" fontSize="0.8em">
      <DisassemblyToolbar
        autoRefresh={autoRefresh}
        bankLabel={bankLabel}
        decimalView={decimalView}
        machineState={machineState}
        onAutoRefreshChanged={async (value) => {
          setAutoRefresh(value);
          if (value) {
            setToScroll(0);
          }
          setScrollVersion((version) => version + 1);
          await refreshDisassembly();
        }}
        onDecimalViewChanged={setDecimalView}
        onGoToAddress={(address) => {
          setToScroll(address);
          setScrollVersion((version) => version + 1);
        }}
        onGoToPc={() => {
          setToScroll(pausedPc);
          setScrollVersion((version) => version + 1);
        }}
        onManualRefresh={async () => {
          await refreshDisassembly();
          dispatch(setIdeStatusMessageAction("Disassembly refreshed", true));
        }}
        onRamChanged={setRam}
        onScreenChanged={setScreen}
        onShowBankLabelChanged={setBankLabel}
        pausedPc={pausedPc}
        ram={ram}
        screen={screen}
        topAddress={topAddress}
      />
      <DisassemblyBankToolbar
        allowViews={machineSetup.allowViews}
        autoRefresh={autoRefresh}
        currentSegment={currentSegment}
        decimalView={decimalView}
        disassOffset={disassOffset}
        displayBankMatrix={machineSetup.displayBankMatrix}
        isFullView={isFullView}
        machineId={machineId}
        offsetOptions={createDisassemblyOffsetOptions(decimalView)}
        onCurrentSegmentChanged={setCurrentSegment}
        onDisassOffsetChanged={setDisassOffset}
        onFullViewChanged={setIsFullView}
        segmentOptions={machineSetup.segmentOptions}
      />
      {items.length > 0 && (
        <div className={styles.disassemblyWrapper}>
          <VirtualizedList
            items={items}
            apiLoaded={(api) => (vlApi.current = api)}
            itemSize={DISASSEMBLY_ROW_ITEM_SIZE}
            overscan={25}
            revealUnmeasuredItems
            onScroll={async () => {
              if (!vlApi.current) return;

              const startIndex = vlApi.current.findStartIndex();
              const item = items[startIndex];
              if (item) {
                pendingScrollTopAddress.current = item.address;
              }
            }}
            onScrollEnd={() => {
              const nextTopAddress = pendingScrollTopAddress.current;
              setTopAddress((currentTopAddress) =>
                nextTopAddress === currentTopAddress ? currentTopAddress : nextTopAddress
              );
            }}
            renderItem={(idx) => {
              const item = items[idx];
              if (!item) return <div></div>;

              return (
                <DisassemblyRow
                  bankLabel={bankLabel}
                  breakpoint={breakpointMap.get(item.address)}
                  currentSegment={currentSegment}
                  decimalView={decimalView}
                  index={idx}
                  isFullView={isFullView}
                  item={item}
                  mem64kLabels={mem64kLabels}
                  partitionLabels={machineSetup.partitionLabels}
                  pausedPc={pausedPc}
                  rowHeight={DISASSEMBLY_ROW_ITEM_SIZE}
                  showBanks={machineSetup.showBanks}
                />
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
