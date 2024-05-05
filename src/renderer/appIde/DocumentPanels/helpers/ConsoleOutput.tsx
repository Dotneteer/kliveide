import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import styles from "./ConsoleOutput.module.scss";
import {
  IOutputBuffer,
  OutputContentLine,
  OutputSpan
} from "@renderer/appIde/ToolArea/abstractions";
import { VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import { VirtualizedListView } from "@renderer/controls/VirtualizedListView";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { ConsoleAction } from "@common/utils/output-utils";

const SCROLL_DELAY = 500;

type Props = {
  buffer: IOutputBuffer;
  scrollLocked: boolean;
  initialTopPosition?: number;
  showLineNo?: boolean;
  onTopPositionChanged?: (position: number) => void;
  onContentsChanged?: () => void;
};

export const ConsoleOutput = ({
  buffer,
  scrollLocked,
  initialTopPosition,
  showLineNo,
  onTopPositionChanged,
  onContentsChanged
}: Props) => {
  // --- Component state
  const mounted = useRef(false);
  const vlApi = useRef<VirtualizedListApi>(null);
  const [output, setOutput] = useState<OutputContentLine[]>([]);
  const [scrollVersion, setScrollVersion] = useState(0);

  // --- Refresh the output
  const lastRefreshTimestamp = useRef(0);
  const refreshOutput = () => {
    if (!buffer) return;
    setOutput(buffer.getContents().slice());
    onContentsChanged?.();
    if (scrollLocked) return;

    // --- Scroll to the end of the output
    const now = Date.now();
    if (now - lastRefreshTimestamp.current > SCROLL_DELAY) {
      lastRefreshTimestamp.current = now;
      vlApi.current?.scrollToEnd();
    } else {
      (async () => {
        // --- Delay 500ms
        await new Promise(resolve => setTimeout(resolve, SCROLL_DELAY));
        if (mounted.current) {
          vlApi.current?.scrollToEnd();
        }
      })();
    }
  };

  // --- Initialize the script output
  useEffect(() => {
    refreshOutput();
    setScrollVersion(scrollVersion + 1);
  }, [buffer]);

  // --- Subscribe to output changes
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      buffer?.contentsChanged.on(refreshOutput);
    }
    return () => {
      if (mounted.current) {
        buffer?.contentsChanged.off(refreshOutput);
        mounted.current = false;
      }
    };
  });

  return (
    <div className={styles.listWrapper}>
      {output && output.length > 0 && (
        <VirtualizedListView
          items={output ?? []}
          approxSize={24}
          fixItemHeight={false}
          scrolled={() => {
            if (!vlApi.current) return;
            onTopPositionChanged?.(vlApi.current.getScrollTop());
          }}
          vlApiLoaded={api => {
            vlApi.current = api;
            if (initialTopPosition !== undefined) {
              vlApi.current?.scrollToOffset(initialTopPosition, {
                align: "start"
              });
            }
          }}
          itemRenderer={idx => {
            return (
              <OutputLine
                lineNo={idx + 1}
                showLineNo={showLineNo}
                spans={output?.[idx]?.spans}
              />
            );
          }}
        />
      )}
    </div>
  );
};

type OutputContentLineProps = {
  spans: OutputSpan[];
  lineNo: number;
  showLineNo?: boolean;
};

const OutputLine = ({ spans, lineNo, showLineNo }: OutputContentLineProps) => {
  const { ideCommandsService } = useAppServices(); 
  const segments = (spans ?? []).map((s, idx) => {
    const style: CSSProperties = {
      fontWeight: s.isBold ? 600 : 400,
      fontStyle: s.isItalic ? "italic" : "normal",
      backgroundColor: `var(${
        s.background !== undefined
          ? `--console-ansi-${s.background}`
          : "transparent"
      })`,
      color: `var(${
        s.foreGround !== undefined
          ? `--console-ansi-${s.foreGround}`
          : "--console-default"
      })`,
      textDecoration: `${s.isUnderline ? "underline" : ""} ${
        s.isStrikeThru ? "line-through" : ""
      }`,
      cursor: s.actionable ? "pointer" : undefined
    };
    return (
      <span
        key={idx}
        style={style}
        onClick={async () => {
          if (s.actionable) {
            // --- Execute the command
            if ((s.data as ConsoleAction)?.type === "@navigate") {
              console.log("Navigate to");
              const payload = (s.data as ConsoleAction).payload;
              if (!payload) return;
              await ideCommandsService.executeCommand(
                `nav "${payload.file}" ${payload.line != undefined ? payload.line : ""} ${
                  payload.column != undefined ? (payload.column + 1).toString() : ""
                }`
              );
            } else if (typeof s.data === "function") {
              s.data();
            }
          }
        }}
      >
        {s.text}
      </span>
    );
  });
  return (
    <div className={styles.outputLine}>
      {showLineNo && <span className={styles.lineNo}>{lineNo}:</span>}
      {[...segments]}
    </div>
  );
};
