import { SmallIconButton } from "@controls/IconButton";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { ToolbarSeparator } from "@controls/ToolbarSeparator";
import { VirtualizedListApi } from "@controls/VirtualizedList";
import { VirtualizedListView } from "@controls/VirtualizedListView";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { setIdeStatusMessageAction } from "@state/actions";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { toHexa2 } from "../services/ide-commands";
import { useStateRefresh } from "../useStateRefresh";
import {
  BasicLine,
  BasicLineSpan,
  BasicProgramBuffer,
  getMemoryWord,
  SpectrumColor
} from "./BasicLine";
import styles from "./BasicPanel.module.scss";
import { useDocumentHubService } from "../services/DocumentServiceProvider";
import classnames from "classnames";
import { useEmuApi } from "@renderer/core/EmuApi";
import { ErrorBoundary } from "@renderer/controls/ErrorBoundary";
import { useAppServices } from "../services/AppServicesProvider";

type BasicViewState = {
  topIndex?: number;
  autoRefresh?: boolean;
  showCodes?: boolean;
  showSpectrumFont?: boolean;
};

const BasicPanel = ({ viewState }: DocumentProps<BasicViewState>) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const emuApi = useEmuApi();

  const documentHubService = useDocumentHubService();

  // --- Read the view state of the document
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

  // --- Creates the addresses to represent dump sections
  const createListing = () => {
    const buffer = programBuffer.current;
    buffer.clear();
    const getWord = (address: number) => getMemoryWord(memory.current, address);

    // --- Read PROG and VARS to get the program boundaries
    const progStart = getWord(0x5c53);
    const progEnd = getWord(0x5c4b);
    let corrupted = progStart > progEnd;
    let currentPos = progStart;
    let lastLineNo = -1;

    while (!corrupted && currentPos < progEnd) {
      const lineNo = (memory.current[currentPos] << 8) + memory.current[currentPos + 1];
      currentPos += 2;
      const lineLength = getWord(currentPos);
      currentPos += 2;
      const nextLine = currentPos + lineLength;

      // --- Check for line number/length corruption
      if (lineNo > 9999 || lineNo < lastLineNo) {
        corrupted = true;
        break;
      }

      if (nextLine > progEnd + 1) {
        corrupted = true;
        break;
      }

      // --- Start displaying the line
      lastLineNo = lineNo;
      let lastCode = 0;
      buffer.resetColor();
      let segment = "";
      let withinQuotes = false;

      // --- Line number
      buffer.ink("cyan");
      buffer.write(lineNo.toString().padStart(4, "\xa0") + "\xa0");
      buffer.resetColor();

      // --- Iterate through the line
      while (currentPos < nextLine) {
        if (showCodes) {
          buffer.resetColor();
        }

        const code = memory.current[currentPos++];

        if (code === 0x0e) {
          currentPos += 5;
          continue;
        }

        if (code === 0x0d) {
          continue;
        }

        if (code === 0x22) {
          withinQuotes = !withinQuotes;
        }

        const nextSymbol = machineCharSet[code];
        switch (nextSymbol.c) {
          case "ctrl":
            if (useCodes.current) {
              buffer.paper("blue");
              buffer.ink("white");
              segment += `$${toHexa2(code)}`;
            }
            break;
          case "graph":
            if (useCodes.current) {
              buffer.paper("magenta");
              buffer.ink("white");
              segment += `$${toHexa2(code)}`;
            }
            break;
          case "pr":
            if (useCodes.current) {
              buffer.paper("magenta");
              buffer.ink("white");
              segment += `$${toHexa2(code)}`;
            }
            switch (code) {
              case 0x10:
                if (!useCodes.current) {
                  buffer.ink(getColorCode(memory.current[currentPos++]));
                } else {
                  currentPos++;
                }
                break;
              case 0x11:
                if (!useCodes.current) {
                  buffer.paper(getColorCode(memory.current[currentPos++]));
                } else {
                  currentPos++;
                }
                break;
              case 0x12:
                if (!useCodes.current) {
                  buffer.flash(memory.current[currentPos++] !== 0);
                } else {
                  currentPos++;
                }
                break;
              case 0x13:
                if (!useCodes.current) {
                  buffer.bright(memory.current[currentPos++] !== 0);
                } else {
                  currentPos++;
                }
                break;
              case 0x14:
                if (!useCodes.current) {
                  buffer.inverse(memory.current[currentPos++] !== 0);
                } else {
                  currentPos++;
                }
                break;
              case 0x15:
                if (useCodes.current) {
                  const over = memory.current[currentPos++];
                  buffer.paper("magenta");
                  buffer.ink("white");
                  segment += `$${toHexa2(over)}`;
                } else {
                  currentPos++;
                }
                break;
              case 0x16:
                if (useCodes.current) {
                  const row = memory.current[currentPos++];
                  buffer.paper("magenta");
                  buffer.ink("white");
                  segment += `$${toHexa2(row)}`;
                  const col = memory.current[currentPos++];
                  segment += `$${toHexa2(col)}`;
                } else {
                  currentPos += 2;
                }
                break;
              case 0x17:
                if (useCodes.current) {
                  buffer.paper("magenta");
                  buffer.ink("white");
                  segment += "$17";
                }
            }
            break;
          case "udg":
            if (useCodes.current) {
              buffer.paper("green");
              buffer.ink("white");
              segment += `$${toHexa2(code)}`;
            }
            break;
          case "token":
            if (
              (lastCode >= "a".charCodeAt(0) && lastCode <= "z".charCodeAt(0)) ||
              (lastCode >= "A".charCodeAt(0) && lastCode <= "Z".charCodeAt(0)) ||
              (lastCode >= "0".charCodeAt(0) && lastCode <= "9".charCodeAt(0))
            ) {
              segment += "\xa0";
            }
            segment += nextSymbol.t.toUpperCase();
            segment += " ";
            break;
          default:
            segment = nextSymbol.v;
            if ((nextSymbol.v === ":" || nextSymbol.v === ";") && !withinQuotes) {
              segment += "\xa0";
            }
            break;
        }

        if (segment) {
          buffer.write(segment);
          segment = "";
        }

        lastCode = code;
      }

      // --- Next line
      currentPos = nextLine;
      buffer.writeLine();
    }

    // --- Mark corrupted code
    if (corrupted) {
      buffer.resetColor();
      buffer.writeLine();
      buffer.bright(true);
      buffer.paper("white");
      buffer.ink("red");
      buffer.inverse(true);
      buffer.writeLine("*** BASIC code corrupted or partially loaded ***");
    }

    // --- Done.
    const lines = buffer.getContents();
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
    const mergedState: BasicViewState = {
      topIndex,
      autoRefresh,
      showCodes,
      showSpectrumFont
    };
    documentHubService.saveActiveDocumentState(mergedState);
  }, [topIndex, autoRefresh, showCodes, showSpectrumFont]);
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
  useStateRefresh(500, () => {
    refreshBasicView(useAutoRefresh.current);
  });

  // --- Save the current top addresds
  const storeTopAddress = () => {
    const range = vlApi.current.getRange();
    setTopIndex(range.startIndex);
  };

  return (
    <div className={styles.basicPanel}>
      <div className={styles.header}>
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
      </div>
      {!showListing.current && (
        <div className={styles.center}>Machine OS has not been initialized yet</div>
      )}
      {showListing.current && basicLines && !basicLines.length && (
        <div className={styles.center}>BASIC program area is empty</div>
      )}
      {showListing.current && basicLines && basicLines.length > 0 && (
        <div className={styles.listWrapper}>
          <ErrorBoundary>
            <VirtualizedListView
              items={basicLines}
              approxSize={20}
              fixItemHeight={false}
              scrolled={() => {
                if (!vlApi.current || cachedLines.current.length === 0) return;
                storeTopAddress();
              }}
              vlApiLoaded={(api) => (vlApi.current = api)}
              itemRenderer={(idx) => {
                return (
                  <div className={styles.item}>
                    <BasicLineDisplay
                      spans={basicLines[idx]?.spans}
                      showSpectrumFont={showSpectrumFont}
                    />
                  </div>
                );
              }}
            />
          </ErrorBoundary>
        </div>
      )}
    </div>
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

const colorCodes: SpectrumColor[] = [
  "black",
  "blue",
  "red",
  "magenta",
  "green",
  "cyan",
  "yellow",
  "white"
];

function getColorCode(code: number): SpectrumColor {
  return colorCodes[code & 0x07];
}

export const createBasicPanel = ({ viewState }: DocumentProps) => (
  <BasicPanel viewState={viewState} apiLoaded={() => {}} />
);
