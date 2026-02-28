import { useEffect, useRef, useState } from "react";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { FullPanel } from "@renderer/controls/new/Panels";
import { PanelHeader } from "./helpers/PanelHeader";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { LabelSeparator } from "@renderer/controls/Labels";
import { IconButton } from "@renderer/controls/IconButton";
import styles from "./ImageViewerPanel.module.scss";

type ImageViewerViewState = {
  zoomIndex?: number;
  fitToWidth?: boolean;
};

const ZOOM_LEVELS = [0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8];
const DEFAULT_ZOOM_INDEX = ZOOM_LEVELS.indexOf(1);

function formatZoom(z: number): string {
  if (z === 0.125) return "⅛×";
  if (z === 0.25) return "¼×";
  if (z === 0.5) return "½×";
  return `${z}×`;
}

const ImageViewerPanelComponent = ({ document, contents }: DocumentProps) => {
  const data = contents as Uint8Array;
  const documentHubService = useDocumentHubService();

  // Load view state once on mount
  const viewState = useRef(
    (documentHubService.getDocumentViewState(document.id) as ImageViewerViewState) ?? {}
  );

  const [zoomIndex, setZoomIndex] = useState(viewState.current?.zoomIndex ?? DEFAULT_ZOOM_INDEX);
  const [fitToWidth, setFitToWidth] = useState(viewState.current?.fitToWidth ?? false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  // Drag-to-pan state (refs to avoid re-renders)
  const isPanning = useRef(false);
  const panOrigin = useRef({ x: 0, y: 0 });
  const scrollOrigin = useRef({ left: 0, top: 0 });

  // Register global mousemove / mouseup for panning
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning.current || !containerRef.current) return;
      const dx = e.clientX - panOrigin.current.x;
      const dy = e.clientY - panOrigin.current.y;
      containerRef.current.scrollLeft = scrollOrigin.current.left - dx;
      containerRef.current.scrollTop = scrollOrigin.current.top - dy;
    };
    const onMouseUp = () => {
      if (!isPanning.current) return;
      isPanning.current = false;
      if (containerRef.current) containerRef.current.style.cursor = "grab";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Save view state whenever zoom or fit changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    documentHubService.saveActiveDocumentState({ zoomIndex, fitToWidth });
  }, [zoomIndex, fitToWidth]);

  // Create an object URL for the binary image data and revoke it on cleanup
  useEffect(() => {
    if (!data || data.length === 0) {
      setDataUrl(null);
      setNaturalWidth(0);
      return () => {};
    }
    const blob = new Blob([data.slice()], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    setDataUrl(url);
    setNaturalWidth(0);
    return () => URL.revokeObjectURL(url);
  }, [data]);

  if (!data || data.length === 0 || !dataUrl) {
    return <div className={styles.message}>No image content.</div>;
  }

  const zoom = ZOOM_LEVELS[zoomIndex];
  const scaledWidth = naturalWidth > 0 ? naturalWidth * zoom : undefined;
  const imgStyle: React.CSSProperties = fitToWidth
    ? { width: "100%", height: "auto", display: "block" }
    : scaledWidth
      ? { width: `${scaledWidth}px`, height: "auto", display: "block" }
      : { maxWidth: "100%", height: "auto", display: "block" };

  const zoomLabel = fitToWidth ? "Fit" : formatZoom(zoom);

  return (
    <FullPanel>
      <PanelHeader>
        <LabeledSwitch
          label="Fit Width"
          title="Fit image to panel width"
          value={fitToWidth}
          clicked={(v) => setFitToWidth(v)}
        />
        <LabelSeparator width={8} />
        <IconButton
          iconName="zoom-out"
          iconSize={16}
          buttonWidth={24}
          buttonHeight={24}
          title="Zoom out"
          enable={!fitToWidth && zoomIndex > 0}
          clicked={() => setZoomIndex((i) => Math.max(0, i - 1))}
        />
        <div className={styles.zoomLabel} title="Click to reset to 100%" onClick={() => { setZoomIndex(DEFAULT_ZOOM_INDEX); setFitToWidth(false); }}>
          {zoomLabel}
        </div>
        <IconButton
          iconName="zoom-in"
          iconSize={16}
          buttonWidth={24}
          buttonHeight={24}
          title="Zoom in"
          enable={!fitToWidth && zoomIndex < ZOOM_LEVELS.length - 1}
          clicked={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
        />
      </PanelHeader>
      <div
        ref={containerRef}
        className={styles.imageContainer}
        style={{ cursor: "grab" }}
        onMouseDown={(e) => {
          if (!containerRef.current) return;
          isPanning.current = true;
          panOrigin.current = { x: e.clientX, y: e.clientY };
          scrollOrigin.current = {
            left: containerRef.current.scrollLeft,
            top: containerRef.current.scrollTop
          };
          containerRef.current.style.cursor = "grabbing";
          e.preventDefault();
        }}
      >
        <img
          src={dataUrl}
          alt="Preview"
          style={imgStyle}
          draggable={false}
          onLoad={(e) => setNaturalWidth(e.currentTarget.naturalWidth)}
        />
      </div>
    </FullPanel>
  );
};

export const createImageViewerPanel = ({ document, contents, apiLoaded }: DocumentProps) => (
  <ImageViewerPanelComponent document={document} contents={contents} apiLoaded={apiLoaded} />
);
