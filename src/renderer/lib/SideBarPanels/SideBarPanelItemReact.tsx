import {
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import {
  clearPanelDragPayload,
  hasPanelDragPayload,
  readPanelDragPayload,
  writePanelDragPayload
} from "../PanelDragDrop/panelDragDrop";
import styles from "./SideBarPanels.module.scss";
import { SideBarPanelStackContext } from "./SideBarPanelStackContext";

export type SideBarPanelItemReactProps = {
  panelId: string;
  title: string;
  expanded?: boolean;
  initialSize?: number;
  order?: number;
  children?: ReactNode;
  onToggle?: () => void;
};

export function SideBarPanelItemReact({
  panelId,
  title,
  expanded = false,
  initialSize = 1000,
  order = 0,
  children,
  onToggle
}: SideBarPanelItemReactProps) {
  const stack = useContext(SideBarPanelStackContext);
  const elementRef = useRef<HTMLDivElement>(null);
  const collapseTimer = useRef<number | undefined>(undefined);
  const [animate, setAnimate] = useState(false);
  const [renderContent, setRenderContent] = useState(expanded);
  const size = stack?.getPanelSize(panelId, initialSize) ?? initialSize;
  const minPanelSize = stack?.minPanelSize ?? 120;
  const sizeable = stack?.isPanelSizeable(panelId) ?? false;
  const isDragging = stack?.draggingPanelId === panelId;
  const shouldAnimate = animate && !stack?.isResizing;
  const panelStyle: CSSProperties = expanded
    ? { flexGrow: size, flexBasis: "0px", minHeight: `${minPanelSize}px`, order }
    : { flexGrow: 0, flexBasis: "26px", minHeight: "26px", order };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnimate(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (collapseTimer.current !== undefined) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = undefined;
    }

    if (expanded) {
      setRenderContent(true);
      return;
    }

    collapseTimer.current = window.setTimeout(() => {
      setRenderContent(false);
      collapseTimer.current = undefined;
    }, animate ? 180 : 0);

    return () => {
      if (collapseTimer.current !== undefined) {
        window.clearTimeout(collapseTimer.current);
        collapseTimer.current = undefined;
      }
    };
  }, [animate, expanded]);

  useEffect(() => {
    stack?.registerPanel({ panelId, expanded, initialSize, order, elementRef });
    return () => stack?.unregisterPanel(panelId);
  }, [expanded, initialSize, order, panelId, stack]);

  return (
    <div
      ref={elementRef}
      className={`${styles.panel} ${shouldAnimate ? styles.animated : ""} ${
        expanded ? styles.expanded : styles.collapsed
      }`}
      data-panel-id={panelId}
      style={panelStyle}
    >
      <button
        className={styles.header}
        type="button"
        draggable
        onClick={onToggle}
        onDragStart={(event) => {
          writePanelDragPayload(event, {
            type: "klive/panel-instance",
            instanceId: panelId
          });
        }}
        onDragEnd={() => {
          clearPanelDragPayload();
          stack?.clearPanelDropPreview();
        }}
        onDragOver={(event) => {
          if (!hasPanelDragPayload(event)) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          const payload = readPanelDragPayload(event);
          if (!payload) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          stack?.previewPanelDrop(
            payload.instanceId,
            panelId,
            event.clientY > bounds.top + bounds.height / 2
          );
        }}
        onDrop={(event) => {
          const payload = readPanelDragPayload(event);
          if (!payload) return;
          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          stack?.movePanelToIndex(
            payload.instanceId,
            panelId,
            event.clientY > bounds.top + bounds.height / 2
          );
          clearPanelDragPayload();
        }}
        aria-expanded={expanded}
      >
        <span className={`${styles.chevron} ${expanded ? styles.openChevron : ""}`} aria-hidden="true">
          &rsaquo;
        </span>
        <span className={styles.title}>{title}</span>
      </button>
      {renderContent && (
        <div className={`${styles.content} ${expanded ? styles.contentOpen : styles.contentClosed}`}>
          <div className={styles.contentScroller}>{children}</div>
          <div
            className={`${styles.grip} ${sizeable ? styles.sizeable : ""} ${
              isDragging ? styles.dragging : ""
            }`}
            onMouseDown={(event) => {
              if (!sizeable || event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              stack?.startResize(panelId, event.clientY);
            }}
          />
        </div>
      )}
    </div>
  );
}
