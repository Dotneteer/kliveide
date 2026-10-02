import { useLayoutEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";
import {
  blockStartTimes,
  formatPlayTime,
  segmentOfBlock,
  tapeTimeline,
  type TapeBlockInfo,
  type TapeTimelineSegment
} from "./tapeView";
import styles from "./TapeTimeline.module.scss";

/*
 * The tape in play order, one thin bar (`.plans/TAPE_VIEWER_PLAN.md` §4.4.1).
 *
 * It adds the one thing the block list cannot show - where each block sits in time, and how much of
 * the tape it takes - without being a second way to browse: it is not a tab stop (the list's
 * keyboard moves the selection and the strip follows), and it is hidden from screen readers, who
 * would otherwise hear the list twice. A click on a segment selects its block in the list.
 *
 * Static by decision: it does not follow the tape while the machine loads (§7, Q4).
 */

type Props = {
  blocks: TapeBlockInfo[];
  selectedIndex?: number;
  onSelect: (index: number) => void;
};

export const TapeTimeline = ({ blocks, selectedIndex, onSelect }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const update = () => setWidth(element.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const segments = useMemo(() => tapeTimeline(blocks, width), [blocks, width]);
  const starts = useMemo(() => blockStartTimes(blocks), [blocks]);
  const selected =
    selectedIndex === undefined ? undefined : segmentOfBlock(segments, selectedIndex);

  const tooltip = (segment: TapeTimelineSegment) => {
    const first = blocks[segment.first];
    const last = blocks[segment.last];
    const end = starts[segment.last] + last.durationMs;
    const span = `${formatPlayTime(starts[segment.first])}–${formatPlayTime(end)}`;
    const approx = blocks.slice(segment.first, segment.last + 1).some((b) => b.durationApprox)
      ? " (approx.)"
      : "";
    if (segment.first !== segment.last) {
      return `#${segment.first}–#${segment.last} · ${segment.last - segment.first + 1} blocks · ${span}${approx}`;
    }
    return `#${first.index} · ${first.kindName} · ${first.groupLabel} · ${span}${approx}`;
  };

  return (
    <div className={styles.timeline} ref={ref} aria-hidden="true" data-testid="tape-timeline">
      {segments.map((segment) => (
        <div
          key={segment.first}
          className={classnames(styles.segment, styles[segment.tone])}
          style={{ left: segment.x, width: segment.width }}
          title={tooltip(segment)}
          data-first={segment.first}
          onClick={() => onSelect(segment.first)}
        />
      ))}
      {selected && (
        <div
          className={styles.selection}
          style={{ left: selected.x, width: selected.width }}
          data-testid="tape-timeline-selection"
        />
      )}
    </div>
  );
};
