import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import styles from "./ConsoleOutput.module.scss";
import {
  IOutputBuffer,
  OutputContentLine,
  OutputSpan
} from "@renderer/appIde/ToolArea/abstractions";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { ConsoleAction } from "@common/utils/output-utils";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";

const SCROLL_END = 5_000_000;

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
  const vlApi = useRef<VListHandle>(null);
  const [output, setOutput] = useState<OutputContentLine[]>([]);
  const [scrollVersion, setScrollVersion] = useState(0);

  // --- Refresh the output
  const refreshOutput = () => {
    if (!buffer) return;
    setOutput(buffer.getContents().slice());
    onContentsChanged?.();
    if (scrollLocked) return;

    // --- Scroll to the end of the output
    vlApi.current?.scrollToIndex(SCROLL_END);
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
        <VirtualizedList
          items={output ?? []}
          onScroll={() => {
            if (!vlApi.current) return;
            onTopPositionChanged?.(vlApi.current.getItemOffset(0));
          }}
          apiLoaded={api => {
            vlApi.current = api;
            if (initialTopPosition !== undefined) {
              vlApi.current?.scrollTo(initialTopPosition);
            }
          }}
          renderItem={idx => {
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
        s.foreground !== undefined
          ? `--console-ansi-${s.foreground}`
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
