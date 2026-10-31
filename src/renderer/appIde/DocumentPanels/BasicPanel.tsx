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
import { decodeZx8081Program, type Zx8081BasicKind, zx8081ProgramArea } from "./zx8081BasicListing";
import { decodeHt1080zProgram, ht1080zProgramArea } from "./ht1080zBasicListing";
import { decodeTvcProgram } from "./tvcBasicListing";
import { decodeEpBasicListing } from "./epBasicListing";
import {
  MC_HT_MODEL,
  MC_TVC_MODEL,
  MC_ZX80_ROM8K,
  MI_HT1080Z,
  MI_TVC, MI_ENTERPRISE,
  MI_ZX80,
  MI_ZX81
} from "@common/machines/constants";
import { charSetOfModel } from "@common/machines/info-types";
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
import { useT } from "@common/i18n/useT";

const BasicPanel = ({ document, viewState }: DocumentProps<BasicViewState>) => {
  // --- Get the services used in this component
  const t = useT();
  const dispatch = useDispatch();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();

  const documentHubService = useDocumentHubService();

  // --- Read the view state of the rendered document
  const [topIndex, setTopIndex] = useState(viewState?.topIndex ?? 0);

  // --- Use these app state variables
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const { machineService } = useAppServices();
  const machineCharSet = charSetOfModel(machineService.getMachineInfo());
  // --- The ZX81 and ZX80 keep their programs in their own formats; a ZX80 with the 8K ROM runs the
  // --- ZX81's BASIC
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const zx80Rom8k = useSelector((s) => s.emulatorState?.config?.[MC_ZX80_ROM8K] === true);
  const zx8081Kind: Zx8081BasicKind | undefined =
    machineId === MI_ZX81 || (machineId === MI_ZX80 && zx80Rom8k)
      ? "zx81"
      : machineId === MI_ZX80
        ? "zx80"
        : undefined;
  const zx8081KindRef = useRef(zx8081Kind);
  zx8081KindRef.current = zx8081Kind;
  // --- The HT-1080Z's Level II BASIC; the /64 shows its backtick pairs as characters
  const htModel = useSelector((s) =>
    s.emulatorState?.machineId === MI_HT1080Z
      ? (s.emulatorState?.config?.[MC_HT_MODEL] ?? "s2")
      : undefined
  );
  const htModelRef = useRef(htModel);
  htModelRef.current = htModel;
  // --- The Videoton TVC's BASIC: 1.2 on the 64K, 2.2 (more keywords) on the 64K+
  const tvcModel = useSelector((s) =>
    s.emulatorState?.machineId === MI_TVC ? (s.emulatorState?.config?.[MC_TVC_MODEL] ?? "64") : undefined
  );
  const tvcModelRef = useRef(tvcModel);
  tvcModelRef.current = tvcModel;
  // --- The Enterprise's IS-BASIC (`epBasicListing.ts`)
  const epBasic = useSelector((s) => s.emulatorState?.machineId === MI_ENTERPRISE);
  const epBasicRef = useRef(epBasic);
  epBasicRef.current = epBasic;
  // --- Machines whose listing is shown in the monospace font, never a Sinclair one
  const ownFont = !!htModel || !!tvcModel || epBasic;
  const charSetRef = useRef(machineCharSet);
  charSetRef.current = machineCharSet;

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

  // --- Lists the program between PROG and VARS (`basicListing.ts`, shared with the tape viewer), or
  // --- a ZX81's or ZX80's in its own format (`zx8081BasicListing.ts`)
  const createListing = () => {
    const getWord = (address: number) => getMemoryWord(memory.current, address);
    const kind = zx8081KindRef.current;
    let lines: BasicLine[];
    if (epBasicRef.current && charSetRef.current) {
      ({ lines } = decodeEpBasicListing(memory.current, {
        charSet: charSetRef.current,
        showCodes: useCodes.current,
        buffer: programBuffer.current
      }));
    } else if (tvcModelRef.current && charSetRef.current) {
      ({ lines } = decodeTvcProgram(memory.current, {
        charSet: charSetRef.current,
        basic22: tvcModelRef.current === "64p",
        showCodes: useCodes.current,
        buffer: programBuffer.current
      }));
    } else if (htModelRef.current && charSetRef.current) {
      const { start, end } = ht1080zProgramArea(memory.current);
      ({ lines } = decodeHt1080zProgram(memory.current, start, end, {
        charSet: charSetRef.current,
        backtickPairs: htModelRef.current === "s64",
        showCodes: useCodes.current,
        buffer: programBuffer.current
      }));
    } else if (kind) {
      const { start, end } = zx8081ProgramArea(memory.current, kind);
      ({ lines } = decodeZx8081Program(memory.current, start, end, kind, {
        showCodes: useCodes.current,
        buffer: programBuffer.current
      }));
    } else {
      ({ lines } = decodeBasicProgram(memory.current, getWord(0x5c53), getWord(0x5c4b), {
        charSet: machineCharSet,
        showCodes: useCodes.current,
        buffer: programBuffer.current
      }));
    }
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

  // --- Whenever the state of view options change, or the machine does
  useEffect(() => {
    refreshBasicView();
  }, [autoRefresh, showCodes, showSpectrumFont, zx8081Kind, htModel, tvcModel, epBasic]);

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
      ? t("panels.doc.basic.emptyProgram")
      : ""
    : t("panels.doc.basic.osNotInitialized");

  return (
    /* --- M1: `0.8em` gave 12.8px here; see `MemoryPanel`. Follows the panel font size now - the
       --- listing's own ZxSpectrum face is applied by `.spectrum` further in. */
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      <PanelHeader>
        <SmallIconButton
          iconName="refresh"
          title={t("panels.doc.common.refreshNow")}
          clicked={async () => {
            refreshBasicView();
            dispatch(setIdeStatusMessageAction(t("panels.doc.basic.refreshed"), true));
          }}
        />
        <ToolbarSeparator small={true} />
        <SmallIconButton
          iconName="copy"
          title={t("panels.doc.common.copyToClipboard")}
          clicked={async () => {
            navigator.clipboard.writeText(programBuffer.current.getBufferText());
            dispatch(setIdeStatusMessageAction(t("panels.doc.basic.copied"), true));
          }}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={autoRefresh}
          label={t("panels.doc.basic.autoRefresh")}
          title={t("panels.doc.basic.autoRefreshTitle")}
          clicked={setAutoRefresh}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={showCodes}
          label={t("panels.doc.basic.showCodes")}
          title={t("panels.doc.basic.showCodesTitle")}
          clicked={setShowCodes}
        />
        {/* --- The Sinclair fonts have no HT-1080Z or TVC glyphs (accents, the /64's mathematical signs) */}
        {!ownFont && <ToolbarSeparator small={true} />}
        {!ownFont && (
          <LabeledSwitch
            value={showSpectrumFont}
            label={t(
              zx8081Kind ? "panels.doc.basic.sinclairFont" : "panels.doc.basic.spectrumFont"
            )}
            title={t("panels.doc.basic.fontTitle")}
            clicked={setShowSpectrumFont}
          />
        )}
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
                  showSpectrumFont={showSpectrumFont && !ownFont}
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
