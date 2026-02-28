import { useEffect, useRef, useState } from "react";
import { DocumentProps } from "@renderer/appIde/DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { FullPanel } from "@renderer/controls/new/Panels";
import { PanelHeader } from "./helpers/PanelHeader";
import Dropdown, { DropdownOption } from "@renderer/controls/Dropdown";
import { LabelSeparator } from "@renderer/controls/Labels";
import { IconButton } from "@renderer/controls/IconButton";
import ScrollViewer, { ScrollViewerApi } from "@renderer/controls/ScrollViewer";
import styles from "./ImageViewerPanel.module.scss";

type FitMode = "original" | "fit-width" | "fit-page";

type ImageViewerViewState = {
  zoomIndex?: number;
  fitMode?: FitMode;
};

const FIT_OPTIONS: DropdownOption[] = [
  { value: "original", label: "Original size" },
  { value: "fit-width", label: "Fit Width" },
  { value: "fit-page", label: "Fit Page" }
];

const ZOOM_LEVELS = [0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8];
const DEFAULT_ZOOM_INDEX = ZOOM_LEVELS.indexOf(1);

function formatZoom(z: number): string {
  if (z === 0.125) return "⅛×";
  if (z === 0.25) return "¼×";
  if (z === 0.5) return "½×";
  return `${z}×`;
}

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  tiff: "image/tiff",
  tif: "image/tiff"
};

function mimeTypeForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[ext] ?? "image/png";
}

const ImageViewerPanelComponent = ({ document, contents }: DocumentProps) => {
  const data = contents as Uint8Array;
  const documentHubService = useDocumentHubService();

  // Load view state once on mount
  const viewState = useRef(
    (documentHubService.getDocumentViewState(document.id) as ImageViewerViewState) ?? {}
  );

  const [zoomIndex, setZoomIndex] = useState(viewState.current?.zoomIndex ?? DEFAULT_ZOOM_INDEX);
  const [fitMode, setFitMode] = useState<FitMode>(viewState.current?.fitMode ?? "original");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const panContainerRef = useRef<HTMLDivElement>(null);
  const scrollApi = useRef<ScrollViewerApi>(null);
  const isInitialMount = useRef(true);

  // Drag-to-pan state (refs to avoid re-renders)
  const isPanning = useRef(false);
  const panOrigin = useRef({ x: 0, y: 0 });
  const scrollOrigin = useRef({ left: 0, top: 0 });

  // Register global mousemove / mouseup for panning
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning.current || !scrollApi.current) return;
      const dx = e.clientX - panOrigin.current.x;
      const dy = e.clientY - panOrigin.current.y;
      scrollApi.current.scrollToHorizontal(scrollOrigin.current.left - dx);
      scrollApi.current.scrollToVertical(scrollOrigin.current.top - dy);
    };
    const onMouseUp = () => {
      if (!isPanning.current) return;
      isPanning.current = false;
      if (panContainerRef.current) panContainerRef.current.style.cursor = "grab";
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
    documentHubService.saveActiveDocumentState({ zoomIndex, fitMode });
  }, [zoomIndex, fitMode]);

  // Create an object URL for the binary image data and revoke it on cleanup
  useEffect(() => {
    if (!data || data.length === 0) {
      setDataUrl(null);
      setNaturalWidth(0);
      setNaturalHeight(0);
      return () => {};
    }
    const blob = new Blob([data.slice()], { type: mimeTypeForName(document?.name ?? "") });
    const url = URL.createObjectURL(blob);
    setDataUrl(url);
    setNaturalWidth(0);
    setNaturalHeight(0);
    return () => URL.revokeObjectURL(url);
  }, [data]);

  if (!data || data.length === 0 || !dataUrl) {
    return <div className={styles.message}>No image content.</div>;
  }

  const zoom = ZOOM_LEVELS[zoomIndex];
  const isOriginal = fitMode === "original";
  const scaledWidth = naturalWidth > 0 ? naturalWidth * zoom : undefined;
  const scaledHeight = naturalHeight > 0 ? naturalHeight * zoom : undefined;
  let imgStyle: React.CSSProperties;
  if (fitMode === "fit-width") {
    imgStyle = { width: "100%", height: "auto", display: "block" };
  } else if (fitMode === "fit-page") {
    imgStyle = {
      maxWidth: "100%",
      maxHeight: "100%",
      width: "auto",
      height: "auto",
      objectFit: "contain",
      display: "block"
    };
  } else {
    // original
    imgStyle =
      scaledWidth && scaledHeight
        ? { width: `${scaledWidth}px`, height: `${scaledHeight}px`, display: "block" }
        : { maxWidth: "100%", height: "auto", display: "block" };
  }

  const zoomLabel = isOriginal ? formatZoom(zoom) : "—";

  return (
    <FullPanel>
      <PanelHeader>
        <Dropdown
          options={FIT_OPTIONS}
          initialValue={fitMode}
          width={110}
          onChanged={(v) => setFitMode(v as FitMode)}
        />
        <LabelSeparator width={8} />
        <IconButton
          iconName="zoom-out"
          iconSize={16}
          buttonWidth={24}
          buttonHeight={24}
          title="Zoom out"
          enable={isOriginal && zoomIndex > 0}
          clicked={() => setZoomIndex((i) => Math.max(0, i - 1))}
        />
        <div
          className={styles.zoomLabel}
          title={isOriginal ? "Click to reset to 100%" : undefined}
          onClick={() => {
            setFitMode("original");
            setZoomIndex(DEFAULT_ZOOM_INDEX);
          }}
        >
          {zoomLabel}
        </div>
        <IconButton
          iconName="zoom-in"
          iconSize={16}
          buttonWidth={24}
          buttonHeight={24}
          title="Zoom in"
          enable={isOriginal && zoomIndex < ZOOM_LEVELS.length - 1}
          clicked={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
        />
      </PanelHeader>
      <div
        ref={panContainerRef}
        className={styles.panContainer}
        style={{ cursor: "grab" }}
        onMouseDown={(e) => {
          if (!scrollApi.current) return;
          isPanning.current = true;
          panOrigin.current = { x: e.clientX, y: e.clientY };
          scrollOrigin.current = {
            left: scrollApi.current.getScrollLeft(),
            top: scrollApi.current.getScrollTop()
          };
          if (panContainerRef.current) panContainerRef.current.style.cursor = "grabbing";
          e.preventDefault();
        }}
      >
        <ScrollViewer
          allowHorizontal={true}
          allowVertical={true}
          apiLoaded={(api) => (scrollApi.current = api)}
        >
          <div
            className={`${styles.imageWrapper}${fitMode === "fit-page" ? " " + styles.imageWrapperFitPage : ""}`}
          >
            <img
              src={dataUrl}
              alt="Preview"
              style={imgStyle}
              draggable={false}
              onLoad={(e) => {
                setNaturalWidth(e.currentTarget.naturalWidth);
                setNaturalHeight(e.currentTarget.naturalHeight);
              }}
            />
          </div>
        </ScrollViewer>
      </div>
    </FullPanel>
  );
};

export const createImageViewerPanel = ({ document, contents, apiLoaded }: DocumentProps) => (
  <ImageViewerPanelComponent document={document} contents={contents} apiLoaded={apiLoaded} />
);
