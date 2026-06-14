import {
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import styles from "./SideBarPanels.module.scss";
import { SideBarPanelStackContext } from "./SideBarPanelStackContext";

export type SideBarPanelItemReactProps = {
  panelId: string;
  title: string;
  expanded?: boolean;
  initialSize?: number;
  children?: ReactNode;
  onToggle?: () => void;
};

export function SideBarPanelItemReact({
  panelId,
  title,
  expanded = false,
  initialSize = 1000,
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
  const panelStyle: CSSProperties = expanded
    ? { flexGrow: size, flexBasis: "0px", minHeight: `${minPanelSize}px` }
    : { flexGrow: 0, flexBasis: "26px", minHeight: "26px" };

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
    stack?.registerPanel({ panelId, expanded, initialSize, elementRef });
    return () => stack?.unregisterPanel(panelId);
  }, [expanded, initialSize, panelId, stack]);

  return (
    <div
      ref={elementRef}
      className={`${styles.panel} ${animate ? styles.animated : ""} ${
        expanded ? styles.expanded : styles.collapsed
      }`}
      data-panel-id={panelId}
      style={panelStyle}
    >
      <button className={styles.header} type="button" onClick={onToggle} aria-expanded={expanded}>
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
