import { useLayoutEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";
import {
  segmentOfBlock,
  timelineLayout,
  type TapeTimelineSegment,
  type TimelineItem
} from "./tapeView";
import styles from "./TapeTimeline.module.scss";

/*
 * A tape in play order, one thin bar: the drawing behind the TAP/TZX viewer's timeline
 * (`TapeTimeline`) and the HT-1080Z tape viewer's. Each item is as wide as its share of the play
 * time (`timelineLayout`), coloured by its tone.
 *
 * Not a tab stop and hidden from screen readers: the list beside it is the way to browse, and the
 * strip follows its selection. A click on a segment selects its item.
 */

type Props = {
  items: TimelineItem[];
  selectedIndex?: number;
  onSelect: (index: number) => void;
  tooltip: (segment: TapeTimelineSegment) => string;
  testId?: string;
};

export const TimelineStrip = ({ items, selectedIndex, onSelect, tooltip, testId = "tape-timeline" }: Props) => {
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

  const segments = useMemo(() => timelineLayout(items, width), [items, width]);
  const selected = selectedIndex === undefined ? undefined : segmentOfBlock(segments, selectedIndex);

  return (
    <div className={styles.timeline} ref={ref} aria-hidden="true" data-testid={testId}>
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
          data-testid={`${testId}-selection`}
        />
      )}
    </div>
  );
};
