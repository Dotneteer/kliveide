import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import styles from "./ConsoleOutput.module.scss";
import {
  IOutputBuffer,
  OutputContentLine,
  OutputSpan
} from "@renderer/appIde/ToolArea/abstractions";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { ConsoleAction } from "@common/utils/output-utils";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";

/**
 * The app's shared rich-text / ANSI console renderer.
 *
 * Four panels use it — `CommandPanel`, `OutputPanel`, `CommandResult` and `ScriptOutputPanel` —
 * across two folders, which is why slice 7.1 gives it a real API rather than leaving each consumer
 * to infer one.
 */

type Props = {
  buffer: IOutputBuffer;
  /**
   * Keep the newest line in view as content arrives.
   *
   * This replaces `scrollLocked`, which meant the opposite of what it read like: `scrollLocked` was
   * *true* when auto-scrolling was **off**. `ScriptOutputPanel` duly shipped a button whose tooltip
   * said "Turn auto scrolling off" at the moment clicking it would turn auto scrolling **on**. A
   * boolean that has to be mentally negated at every call site eventually gets negated wrongly.
   */
  followTail?: boolean;
  /** Show a right-aligned line number gutter. */
  showLineNo?: boolean;
  initialTopPosition?: number;
  onTopPositionChanged?: (position: number) => void;
  onContentsChanged?: () => void;
};

export const ConsoleOutput = ({
  buffer,
  followTail = false,
  showLineNo = false,
  initialTopPosition,
  onTopPositionChanged,
  onContentsChanged
}: Props) => {
  const vlApi = useRef<VListHandle>(null);
  const [lines, setLines] = useState<OutputContentLine[]>([]);

  /*
   * The buffer subscription must not depend on props that change identity every render.
   *
   * `onContentsChanged` is an inline arrow at its call site, so putting it in the dependency list
   * would unsubscribe and resubscribe on every render — which is what the previous dependency-less
   * effect did anyway, once per render, guarded by a `mounted` ref.
   */
  const latest = useRef({ followTail, onContentsChanged });
  latest.current = { followTail, onContentsChanged };

  const refresh = useCallback(() => {
    if (!buffer) return;
    const contents = buffer.getContents().slice();
    setLines(contents);
    latest.current.onContentsChanged?.();
    if (!latest.current.followTail) return;

    /*
     * Scroll to the last line by its index.
     *
     * This used to pass a `SCROLL_END = 5_000_000` sentinel and rely on the virtualizer clamping it,
     * which silently stops being true the day a buffer is longer than the sentinel.
     */
    if (contents.length > 0) {
      vlApi.current?.scrollToIndex(contents.length - 1);
    }
  }, [buffer]);

  const contentLength = buffer?.getContents()?.length ?? 0;
  useEffect(() => {
    refresh();
  }, [refresh, contentLength]);

  useEffect(() => {
    if (!buffer) return undefined;
    buffer.contentsChanged.on(refresh);
    return () => {
      buffer.contentsChanged.off(refresh);
    };
  }, [buffer, refresh]);

  return (
    <div className={styles.listWrapper}>
      {lines.length > 0 && (
        <VirtualizedList
          items={lines}
          onScroll={() => {
            if (!vlApi.current) return;
            onTopPositionChanged?.(vlApi.current.getItemOffset(0));
          }}
          apiLoaded={(api) => {
            vlApi.current = api;
            /*
             * The first scroll has to happen here, not in the refresh effect.
             *
             * The list is only rendered once there is something to show, so on mount the effect
             * runs while `vlApi.current` is still null and its scroll silently no-ops. The result
             * was that `followTail` did nothing until the *next* line arrived: a panel reopened on
             * a buffer that already had content showed the top of it, not the end.
             *
             * A restored scroll position wins over following the tail — that is what the saved
             * view state is for.
             */
            if (initialTopPosition !== undefined) {
              api.scrollTo(initialTopPosition);
            } else if (latest.current.followTail && lines.length > 0) {
              api.scrollToIndex(lines.length - 1);
            }
          }}
          renderItem={(idx) => (
            <OutputLine lineNo={idx + 1} showLineNo={showLineNo} spans={lines[idx]?.spans} />
          )}
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

const spanStyle = (s: OutputSpan): CSSProperties => ({
  fontWeight: s.isBold ? 600 : 400,
  fontStyle: s.isItalic ? "italic" : "normal",
  /*
   * Undefined, not `var(transparent)`.
   *
   * The previous form interpolated the literal word `transparent` into `var()`, which is not a
   * custom-property name, so the declaration was invalid and dropped. It looked correct only
   * because "no background" was the intent anyway — the same class of silent-drop bug as the empty
   * `background-color: var()` found in `.headerRow` during Phase 3.
   */
  backgroundColor: s.background !== undefined ? `var(--console-ansi-${s.background})` : undefined,
  color:
    s.foreground !== undefined ? `var(--console-ansi-${s.foreground})` : "var(--console-default)",
  textDecoration:
    [s.isUnderline ? "underline" : "", s.isStrikeThru ? "line-through" : ""]
      .filter(Boolean)
      .join(" ") || undefined
});

const OutputLine = ({ spans, lineNo, showLineNo }: OutputContentLineProps) => {
  const { ideCommandsService } = useAppServices();

  const activate = async (s: OutputSpan) => {
    if (!s.actionable) return;
    if ((s.data as ConsoleAction)?.type === "@navigate") {
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
  };

  return (
    <div className={styles.outputLine}>
      {showLineNo && <span className={styles.lineNo}>{lineNo}:</span>}
      {(spans ?? []).map((s, idx) =>
        s.actionable ? (
          /*
           * A real <button>.
           *
           * This was a bare <span> with an `onClick` that runs an IDE `nav` command — reachable
           * with a mouse and by nothing else. Same treatment the toolbar and tab controls got in
           * Phase 2: the element that behaves like a button is a button, and the focus ring comes
           * from the app's single `focus-ring` mixin.
           */
          <button
            key={idx}
            type="button"
            className={styles.actionable}
            style={spanStyle(s)}
            onClick={() => activate(s)}
          >
            {s.text}
          </button>
        ) : (
          <span key={idx} style={spanStyle(s)}>
            {s.text}
          </span>
        )
      )}
    </div>
  );
};
