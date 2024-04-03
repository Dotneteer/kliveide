import styles from "./BankedDisassemblyPanel.module.scss";
import { useEffect, useRef, useState } from "react";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { MF_BANK, MF_ROM } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { AddressInput } from "@renderer/controls/AddressInput";
import { LabelSeparator } from "@renderer/controls/Labels";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { LabeledText } from "@renderer/controls/generic/LabeledText";

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
};

export type CachedRefreshState = {
  autoRefresh: boolean;
  viewMode: MemoryViewMode;
  romPage: number;
  ramBank: number;
};

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
  const [currentRomPage, setCurrentRomPage] = useState<number>(0);
  const [currentRamBank, setCurrentRamBank] = useState<number>(0);
  const [bankLabel, setBankLabel] = useState(
    viewState.current?.bankLabel ?? true
  );

  // --- State of the memory view
  const refreshInProgress = useRef(false);
  const memory = useRef<Uint8Array>(new Uint8Array(0x1_0000));
  const [memoryItems, setMemoryItems] = useState<number[]>([]);
  const cachedItems = useRef<number[]>([]);
  const vlApi = useRef<VirtualizedListApi>(null);
  const partitionLabels = useRef<string[]>([]);
  const pointedRegs = useRef<Record<number, string>>({});
  const [scrollVersion, setScrollVersion] = useState(1);

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
      topAddress: topAddress,
      autoRefresh,
      viewMode,
      prevViewMode,
      romPage,
      ramBank,
      bankLabel
    };
    console.log("Saving view state", mergedState);
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
    bankLabel
  ]);

  // --- Initial view: refresh the disassembly lint and scroll to the last saved top position
  useInitializeAsync(async () => {
    setScrollVersion(scrollVersion + 1);
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (!memoryItems.length) return;
    vlApi.current?.scrollToIndex(Math.floor(topAddress), {
      align: "start"
    });
  }, [scrollVersion]);

  return (
    <div className={styles.panel}>
      <div ref={headerRef} className={styles.header} tabIndex={-1}>
      <LabeledText
          label='Range:'
          value={`0000-${viewMode === "full" ? "FFFF" : "3FFF"}`}
        />
        <ToolbarSeparator small={true} />
        <AddressInput
          label='Go To:'
          clearOnEnter={true}
          onAddressSent={async address => {
            // TODO: Implement this
            setScrollVersion(scrollVersion + 1);
          }}
        />
        <LabelSeparator width={8} />
      </div>
      <div className={styles.memoryWrapper}>
        Disassembly view
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
