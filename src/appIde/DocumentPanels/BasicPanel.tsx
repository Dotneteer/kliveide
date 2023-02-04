import { SmallIconButton } from "@/controls/common/IconButton";
import { LabeledSwitch } from "@/controls/common/LabeledSwitch";
import { ToolbarSeparator } from "@/controls/common/ToolbarSeparator";
import { VirtualizedListApi } from "@/controls/common/VirtualizedList";
import { VirtualizedListView } from "@/controls/common/VirtualizedListView";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@/core/RendererProvider";
import { useInitializeAsync } from "@/core/useInitializeAsync";
import { useUncommittedState } from "@/core/useUncommittedState";
import { EmuGetMemoryResponse } from "@messaging/main-to-emu";
import { setIdeStatusMessageAction } from "@state/actions";
import { MachineControllerState } from "@state/MachineControllerState";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { useAppServices } from "../services/AppServicesProvider";
import { toHexa2 } from "../services/interactive-commands";
import { useStateRefresh } from "../useStateRefresh";
import {
  BasicLine,
  BasicLineSpan,
  BasicProgramBuffer,
  getMemoryWord,
  SpectrumColor
} from "./BasicLine";
import styles from "./BasicPanel.module.scss";
import { ZxSpectrumChars } from "./char-codes";

type BasicViewState = {
  topIndex?: number;
  autoRefresh?: boolean;
  showCodes?: boolean;
};

const BasicPanel = ({ document }: DocumentProps) => {
  // --- Read the view state of the document
  const viewState = useRef((document.stateValue as BasicViewState) ?? {});
  const topIndex = useRef(viewState.current?.topIndex ?? 0);

  // --- Use these app state variables
  const machineState = useSelector(s => s.emulatorState?.machineState);

  // --- Get the services used in this component
  const dispatch = useDispatch();
  const { messenger } = useRendererContext();
  const { documentService } = useAppServices();

  // --- Use these options to set memory options. As memory view is async, we sometimes
  // --- need to use state changes not yet committed by React.
  const [autoRefresh, useAutoRefresh, setAutoRefresh] = useUncommittedState(
    viewState.current?.autoRefresh ?? true
  );
  const [showCodes, useCodes, setShowCodes] = useUncommittedState(
    viewState.current?.showCodes ?? false
  );

  const refreshInProgress = useRef(false);
  const memory = useRef<Uint8Array>(new Uint8Array(0x1_0000));
  const [basicLines, setBasicLines] = useState<BasicLine[]>([]);
  const programBuffer = useRef(new BasicProgramBuffer());
  const showListing = useRef(false);
  const cachedLines = useRef<BasicLine[]>([]);
  const vlApi = useRef<VirtualizedListApi>(null);
  const refreshedOnStateChange = useRef(false);
  const [scrollVersion, setScrollVersion] = useState(0);

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
      const lineNo =
        (memory.current[currentPos] << 8) + memory.current[currentPos + 1];
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
      buffer.resetColor();
      let spaceBeforeToken = false;
      let segment = "";
      let withinQuotes = false;

      // --- Line number
      buffer.ink("cyan");
      buffer.write(lineNo.toString().padStart(4, " ") + " ");
      buffer.resetColor();

      // --- Iterate through the line
      while (currentPos < nextLine) {
        if (useCodes.current) {
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

        const nextSymbol = ZxSpectrumChars[code];
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
            if (spaceBeforeToken) segment += "\xa0";
            segment += nextSymbol.t.toUpperCase();
            const lastTokenChar = nextSymbol.t[nextSymbol.t.length - 1];
            if (code > 0xa7 && lastTokenChar >= "A" && lastTokenChar <= "Z") {
              segment += " ";
              spaceBeforeToken = false;
            }
            break;
          default:
            segment = nextSymbol.v;
            if (
              (nextSymbol.v === ":" || nextSymbol.v === ";") &&
              !withinQuotes
            ) {
              segment += "\xa0";
            }
            break;
        }

        if (segment) {
          buffer.write(segment);
          segment = "";
        }
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
    setBasicLines(lines);
  };

  // --- This function refreshes the memory
  const refreshMemoryView = async (toRefresh = true) => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    try {
      // --- Obtain the memory contents
      const response = (await messenger.sendMessage({
        type: "EmuGetMemory"
      })) as EmuGetMemoryResponse;
      memory.current = response.memory;
      showListing.current = response.osInitialized;

      // --- Calculate tooltips for pointed addresses
      if (toRefresh) {
        createListing();
      }
    } finally {
      refreshInProgress.current = false;
    }
  };

  // --- Initial view: refresh the disassembly lint and scroll to the last saved top position
  useInitializeAsync(async () => {
    await refreshMemoryView();
    setScrollVersion(scrollVersion + 1);
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    if (!basicLines.length) return;
    vlApi.current?.scrollToIndex(topIndex.current, {
      align: "start"
    });
  }, [scrollVersion]);

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async () => {
      switch (machineState) {
        case MachineControllerState.Paused:
        case MachineControllerState.Stopped:
          await refreshMemoryView();
          refreshedOnStateChange.current = true;
      }
    })();
  }, [machineState]);

  // --- Whenever the state of view options change
  useEffect(() => {
    refreshMemoryView();
  }, [autoRefresh, showCodes]);

  // --- Take care of refreshing the screen
  useStateRefresh(500, () => {
    refreshMemoryView(useAutoRefresh.current || refreshedOnStateChange.current);
    refreshedOnStateChange.current = false;
  });

  // --- Save the current top addresds
  const storeTopAddress = () => {
    const range = vlApi.current.getRange();
    topIndex.current = range.startIndex;
  };

  // --- Save the new view state whenever the view is scrolled
  const scrolled = () => {
    if (!vlApi.current || cachedLines.current.length === 0) return;

    storeTopAddress();
    saveViewState();
  };

  // --- Save the current view state
  const saveViewState = () => {
    const mergedState: BasicViewState = {
      topIndex: topIndex.current,
      autoRefresh: useAutoRefresh.current,
      showCodes: useCodes.current
    };
    documentService.saveActiveDocumentState(mergedState);
  };

  return (
    <div className={styles.basicPanel}>
      <div className={styles.header}>
        <SmallIconButton
          iconName='refresh'
          title={"Refresh now"}
          clicked={async () => {
            refreshMemoryView();
            dispatch(
              setIdeStatusMessageAction("BASIC listing refreshed", true)
            );
          }}
        />
        <ToolbarSeparator small={true} />
        <SmallIconButton
          iconName='copy'
          title={"Copy to clipboard"}
          clicked={async () => {
            navigator.clipboard.writeText(
              programBuffer.current.getBufferText()
            );
            dispatch(
              setIdeStatusMessageAction(
                "BASIC listing copied to the clipboard",
                true
              )
            );
          }}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={autoRefresh}
          setterFn={setAutoRefresh}
          label='Auto Refresh:'
          title='Refresh the BASIC listing periodically'
          clicked={() => saveViewState()}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={showCodes}
          setterFn={setShowCodes}
          label='Show Non-Printable:'
          title='Display the non-printable codes'
          clicked={() => saveViewState()}
        />
      </div>
      {!showListing.current && (
        <div className={styles.center}>
          Machine OS has not been initialized yet
        </div>
      )}
      {showListing.current && basicLines && !basicLines.length && (
        <div className={styles.center}>
          BASIC program area is empty
        </div>
      )}
      {showListing.current && basicLines && basicLines.length > 0 && (
        <div className={styles.listWrapper}>
          <VirtualizedListView
            items={basicLines}
            approxSize={20}
            fixItemHeight={false}
            scrolled={scrolled}
            apiLoaded={api => (vlApi.current = api)}
            itemRenderer={idx => {
              return (
                <div className={styles.item}>
                  <BasicLineDisplay spans={basicLines[idx].spans} />
                </div>
              );
            }}
          />
        </div>
      )}
    </div>
  );
};

type LineProps = {
  spans: BasicLineSpan[];
};

let runningIndex = 0;

export const BasicLineDisplay = ({ spans }: LineProps) => {
  const segments = (spans ?? []).map((s, idx) => {
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
      textDecoration: `${s.flash ? "underline" : ""}`
    };
    return (
      <span key={runningIndex++} style={style}>
        {s.text}
      </span>
    );
  });
  return <div className={styles.outputLine}>{[...segments]}</div>;
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

function getColorCode (code: number): SpectrumColor {
  return colorCodes[code & 0x07];
}

export const createBasicPanel = ({ document }: DocumentProps) => (
  <BasicPanel document={document} />
);
