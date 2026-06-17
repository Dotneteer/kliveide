import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";
import { useDispatchSetGlobalSetting } from "../../shared-store";
import styles from "./PersistedSizeSplitter.module.scss";

type SplitterAxis = "horizontal" | "vertical";
type SizedPanePosition = "start" | "end";

type PersistedSizeSplitterProps = {
  settingId: string;
  initialSize?: string;
  axis?: SplitterAxis;
  sizedPanePosition?: SizedPanePosition;
  minSizedPaneSize?: number;
  minMainPaneSize?: number;
  children?: ReactNode;
};

type DragState = {
  pointerId: number;
  startCoordinate: number;
  startSize: number;
};

export function PersistedSizeSplitterReact({
  settingId,
  initialSize = "240px",
  axis = "horizontal",
  sizedPanePosition = "end",
  minSizedPaneSize = 160,
  minMainPaneSize = 360,
  children
}: PersistedSizeSplitterProps) {
  const dispatchSetGlobalSetting = useDispatchSetGlobalSetting();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const savedSizeRef = useRef<string | undefined>(undefined);
  const [containerSize, setContainerSize] = useState(0);
  const [sizedPaneSize, setSizedPaneSize] = useState<number | null>(null);
  const [resizerVisible, setResizerVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sizedPane, mainPane] = toChildArray(children);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize(axis === "horizontal" ? rect.width : rect.height);
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [axis]);

  useEffect(() => {
    if (containerSize <= 0) return;
    const nextSize = clampSizedPaneSize(resolveSize(initialSize, containerSize), containerSize);
    setSizedPaneSize(nextSize);
    savedSizeRef.current = `${Math.round(nextSize)}px`;
  }, [containerSize, initialSize, minMainPaneSize, minSizedPaneSize]);

  useEffect(() => {
    if (containerSize <= 0) return;
    setSizedPaneSize((current) =>
      current === null ? current : clampSizedPaneSize(current, containerSize)
    );
  }, [containerSize, minMainPaneSize, minSizedPaneSize]);

  const actualSizedPaneSize =
    sizedPaneSize ?? (
      containerSize > 0
        ? clampSizedPaneSize(resolveSize(initialSize, containerSize), containerSize)
        : resolveSize(initialSize, 1000)
    );

  return (
    <div
      ref={containerRef}
      className={`${styles.root} ${axis === "horizontal" ? styles.horizontal : styles.vertical}`}
      style={
        {
          "--klive-persisted-splitter-size": `${Math.round(actualSizedPaneSize)}px`
        } as CSSProperties
      }
    >
      {sizedPanePosition === "start" && renderSizedPane()}
      {sizedPanePosition === "start" && renderResizer()}
      {renderMainPane()}
      {sizedPanePosition === "end" && renderResizer()}
      {sizedPanePosition === "end" && renderSizedPane()}
    </div>
  );

  function renderSizedPane() {
    return <div className={`${styles.pane} ${styles.sizedPane}`}>{sizedPane}</div>;
  }

  function renderMainPane() {
    return <div className={`${styles.pane} ${styles.mainPane}`}>{mainPane}</div>;
  }

  function renderResizer() {
    return (
      <div
        onMouseEnter={() => setResizerVisible(true)}
        onMouseLeave={() => {
          if (!isDragging) setResizerVisible(false);
        }}
        onPointerDown={startResize}
        className={`${styles.resizer} ${resizerVisible || isDragging ? styles.resizerActive : ""}`}
      />
    );
  }

  function startResize(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startCoordinate: getEventCoordinate(event),
      startSize: actualSizedPaneSize
    };
    setIsDragging(true);
    setResizerVisible(true);

    const move = (moveEvent: globalThis.PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== moveEvent.pointerId || containerSize <= 0) return;

      const coordinate = getEventCoordinate(moveEvent);
      const delta = sizedPanePosition === "start"
        ? coordinate - dragState.startCoordinate
        : dragState.startCoordinate - coordinate;
      setSizedPaneSize(clampSizedPaneSize(dragState.startSize + delta, containerSize));
    };

    const end = (endEvent: globalThis.PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== endEvent.pointerId) return;

      dragStateRef.current = null;
      setIsDragging(false);
      setResizerVisible(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);

      setSizedPaneSize((current) => {
        const sizeToPersist = Math.round(current ?? actualSizedPaneSize);
        const value = `${sizeToPersist}px`;
        if (value !== savedSizeRef.current) {
          savedSizeRef.current = value;
          dispatchSetGlobalSetting(settingId, value);
        }
        return current;
      });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  function getEventCoordinate(event: Pick<PointerEvent, "clientX" | "clientY">): number {
    return axis === "horizontal" ? event.clientX : event.clientY;
  }

  function clampSizedPaneSize(value: number, size: number): number {
    const maxSizedPaneSize = Math.max(minSizedPaneSize, size - minMainPaneSize);
    return Math.min(Math.max(value, minSizedPaneSize), maxSizedPaneSize);
  }
}

function toChildArray(children: ReactNode): ReactNode[] {
  if (Array.isArray(children)) return children;
  return children === undefined || children === null ? [] : [children];
}

function resolveSize(value: string | undefined, containerSize: number): number {
  const trimmed = value?.trim();
  if (!trimmed) return 240;

  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed);
    return Number.isFinite(percent) ? (containerSize * percent) / 100 : 240;
  }

  const pixels = Number.parseFloat(trimmed);
  return Number.isFinite(pixels) ? Math.abs(pixels) : 240;
}
