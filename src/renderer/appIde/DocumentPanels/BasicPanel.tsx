import { SmallIconButton } from "@controls/IconButton";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { ToolbarSeparator } from "@controls/ToolbarSeparator";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import {
  incProjectFileVersionAction,
  setIdeStatusMessageAction
} from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useEmuStateListener } from "../useStateRefresh";
import { BasicLine, BasicLineSpan, BasicProgramBuffer, getMemoryWord } from "./BasicLine";
import { decodeBasicProgram } from "./basicListing";
import styles from "./BasicPanel.module.scss";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import classnames from "classnames";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import type { VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import { PanelHeader } from "@renderer/controls/data";
import { useMainApi } from "@renderer/core/MainApi";
import {
  type BasicViewState,
  useBasicViewStatePersistence
} from "./basicViewState";

const BasicPanel = ({ document, viewState }: DocumentProps<BasicViewState>) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();

  const documentHubService = useDocumentHubService();

  // --- Read the view state of the rendered document
  const [topIndex, setTopIndex] = useState(viewState?.topIndex ?? 0);

  // --- Use these app state variables
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const { machineService } = useAppServices();
  const machineCharSet = machineService.getMachineInfo()?.machine?.charSet;

  // --- Use these options to set memory options. As memory view is async, we sometimes
  // --- need to use state changes not yet committed by React.
  const [autoRefresh, setAutoRefresh] = useState(viewState?.autoRefresh ?? true);
  const [showCodes, setShowCodes] = useState(viewState?.showCodes ?? false);
  const [showSpectrumFont, setShowSpectrumFont] = useState(viewState?.showSpectrumFont ?? true);

  const refreshInProgress = useRef(false);
  const memory = useRef<Uint8Array>(new Uint8Array(0x1_0000));
  const [basicLines, setBasicLines] = useState<BasicLine[]>([]);
  const programBuffer = useRef(new BasicProgramBuffer());
  const showListing = useRef(false);
  const cachedLines = useRef<BasicLine[]>([]);
  const vlApi = useRef<VirtualizedListApi>(null);
  const [scrollVersion, setScrollVersion] = useState(0);

  const useCodes = useRef(false);
  const useAutoRefresh = useRef(autoRefresh);

  // --- Lists the program between PROG and VARS (`basicListing.ts`, shared with the tape viewer)
  const createListing = () => {
    const getWord = (address: number) => getMemoryWord(memory.current, address);
    const { lines } = decodeBasicProgram(memory.current, getWord(0x5c53), getWord(0x5c4b), {
      charSet: machineCharSet,
      showCodes: useCodes.current,
      buffer: programBuffer.current
    });
    cachedLines.current = lines;
    (async () => {
      await new Promise((r) => setTimeout(r, 500));
      setBasicLines(lines);
    })();
  };

  // --- This function refreshes the BASIC list
  const refreshBasicView = async (toRefresh = true) => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    try {
      // --- Obtain the memory contents
      const response = await emuApi.getMemoryContents();

      memory.current = response.memory;
      showListing.current = response.osInitialized;

      // --- Calculate tooltips for pointed addresses
      if (toRefresh && showListing.current) {
        createListing();
      }
    } finally {
      refreshInProgress.current = false;
    }
  };

  // --- Initial view: refresh the BASIC list and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshBasicView();
    setScrollVersion(scrollVersion + 1);
  });

  useEffect(() => {
    useAutoRefresh.current = autoRefresh;
    useCodes.current = showCodes;
  }, [topIndex, autoRefresh, showCodes, showSpectrumFont]);

  useBasicViewStatePersistence({
    autoRefresh,
    dispatch,
    documentHubService,
    documentId: document?.id,
    incProjectFileVersion: incProjectFileVersionAction,
    mainApi,
    showCodes,
    showSpectrumFont,
    topIndex
  });
  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (!basicLines?.length) return;
    vlApi.current?.scrollToIndex(topIndex, {
      align: "start"
    });
  }, [scrollVersion]);

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async () => {
      switch (machineState) {
        case MachineControllerState.Paused:
        case MachineControllerState.Stopped:
          await refreshBasicView();
      }
    })();
  }, [machineState]);

  // --- Whenever the state of view options change
  useEffect(() => {
    refreshBasicView();
  }, [autoRefresh, showCodes, showSpectrumFont]);

  // --- Take care of refreshing the screen
  useEmuStateListener(emuApi, async () => {
    await refreshBasicView(useAutoRefresh.current);
  });

  // --- Save the current top addresds
  const storeTopAddress = () => {
    setTopIndex(vlApi.current?.findStartIndex());
  };

  const message = showListing.current
    ? basicLines && !basicLines.length
      ? "BASIC program area is empty"
      : ""
    : "Machine OS has not been initialized yet";

  return (
    /* --- M1: `0.8em` gave 12.8px here; see `MemoryPanel`. Follows the panel font size now - the
       --- listing's own ZxSpectrum face is applied by `.spectrum` further in. */
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      <PanelHeader>
        <SmallIconButton
          iconName="refresh"
          title={"Refresh now"}
          clicked={async () => {
            refreshBasicView();
            dispatch(setIdeStatusMessageAction("BASIC listing refreshed", true));
          }}
        />
        <ToolbarSeparator small={true} />
        <SmallIconButton
          iconName="copy"
          title={"Copy to clipboard"}
          clicked={async () => {
            navigator.clipboard.writeText(programBuffer.current.getBufferText());
            dispatch(setIdeStatusMessageAction("BASIC listing copied to the clipboard", true));
          }}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={autoRefresh}
          label="Auto Refresh:"
          title="Refresh the BASIC listing periodically"
          clicked={setAutoRefresh}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={showCodes}
          label="Show Non-Printable:"
          title="Display the non-printable codes"
          clicked={setShowCodes}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={showSpectrumFont}
          label="Use ZX Spectrum font:"
          title="Use ZX Spectrum font to display the list"
          clicked={setShowSpectrumFont}
        />
      </PanelHeader>
      {message && (
        <FullPanel
          horizontalContentAlignment="center"
          verticalContentAlignment="center"
          color="--color-secondary-label"
          fontFamily="--monospace-font"
        >
          {message}
        </FullPanel>
      )}
      {!message && (
        <VirtualizedList
          items={basicLines}
          onScroll={() => {
            if (!vlApi.current || cachedLines.current.length === 0) return;
            storeTopAddress();
          }}
          apiLoaded={(api) => (vlApi.current = api)}
          renderItem={(idx) => {
            return (
              <div
                key={idx}
                className={classnames(styles.item, {
                  [styles.first]: idx === 0,
                  [styles.last]: idx === basicLines.length - 1
                })}
              >
                <BasicLineDisplay
                  spans={basicLines[idx]?.spans}
                  showSpectrumFont={showSpectrumFont}
                />
              </div>
            );
          }}
        />
      )}
    </FullPanel>
  );
};

type LineProps = {
  spans: BasicLineSpan[];
  showSpectrumFont?: boolean;
};

let runningIndex = 0;

export const BasicLineDisplay = ({ spans, showSpectrumFont }: LineProps) => {
  const segments = (spans ?? []).map((s) => {
    const inkColor = s.inverse ? s.paper : s.ink;
    const ink =
      inkColor !== undefined
        ? `--console-ansi-${inkColor}`
        : s.inverse
          ? "--console-ansi-black"
          : "--console-default";
    const paperColor = s.inverse ? s.ink : s.paper;
    const paper =
      paperColor !== undefined
        ? s.bright
          ? `--console-ansi-bright-${paperColor}`
          : `--console-ansi-${paperColor}`
        : s.inverse
          ? s.bright
            ? "--console-ansi-bright-white"
            : "--console-ansi-white"
          : "transparent";

    const style: CSSProperties = {
      backgroundColor: `var(${paper})`,
      color: `var(${ink})`,
      textDecoration: `${s.flash ? "underline" : ""}`,
      paddingTop: showSpectrumFont ? 2 : undefined,
      paddingBottom: showSpectrumFont ? 2 : undefined
    };
    return (
      <span key={runningIndex++} style={style}>
        {s.text}
      </span>
    );
  });
  return (
    <div
      className={classnames({
        [styles.spectrum]: showSpectrumFont
      })}
    >
      {[...segments]}
    </div>
  );
};

export const createBasicPanel = ({ document, viewState }: DocumentProps) => (
  <BasicPanel document={document} viewState={viewState} apiLoaded={() => {}} />
);
